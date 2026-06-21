import { ethers } from 'ethers';
import { prisma } from './lib/prisma';
import fs from 'fs';
import path from 'path';
import { accrueUserYield } from './lib/yield';

// Native env loader for modern Node.js
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    (process as any).loadEnvFile(envPath);
    console.log(`[Sweeper] Loaded environment variables from ${envPath}`);
  }
} catch (e) {
  console.log('[Sweeper] Environment file already loaded or native loadEnvFile not supported.');
}

const RPC_URL = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'https://rpc.arieschain.org';
const LAST_BLOCK_FILE = path.join(process.cwd(), 'data/last_block.txt');

// Ensure data folder exists
if (!fs.existsSync(path.dirname(LAST_BLOCK_FILE))) {
  fs.mkdirSync(path.dirname(LAST_BLOCK_FILE), { recursive: true });
}

let provider: ethers.JsonRpcProvider | null = null;
let lastProcessedBlock = 0;

function connectProvider() {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  console.log(`[Sweeper] Connecting to RPC: ${RPC_URL}`);
}

async function loadLastBlock() {
  if (fs.existsSync(LAST_BLOCK_FILE)) {
    try {
      const data = fs.readFileSync(LAST_BLOCK_FILE, 'utf8').trim();
      lastProcessedBlock = parseInt(data) || 0;
      console.log(`[Sweeper] Loaded last processed block from file: ${lastProcessedBlock}`);
      return;
    } catch (e) {
      console.error(`[Sweeper] Failed to read last block file:`, e);
    }
  }
  
  // Fallback: Get current block from blockchain
  try {
    if (provider) {
      const currentBlock = await provider.getBlockNumber();
      lastProcessedBlock = currentBlock;
      saveLastBlock(currentBlock);
      console.log(`[Sweeper] Initialized last processed block to current: ${lastProcessedBlock}`);
    }
  } catch (err) {
    console.error(`[Sweeper] Failed to fetch current block from RPC:`, err);
    lastProcessedBlock = 0;
  }
}

function saveLastBlock(blockNumber: number) {
  try {
    fs.writeFileSync(LAST_BLOCK_FILE, blockNumber.toString(), 'utf8');
  } catch (e) {
    console.error(`[Sweeper] Failed to write last block file:`, e);
  }
}

// Global Event Topic Hashes
const RECEIVED_TOPIC = ethers.id("Received(address,uint256)");
const PLAN_PURCHASED_TOPIC = ethers.id("PlanPurchased(address,uint256,uint256)");
const REWARDS_CLAIMED_TOPIC = ethers.id("RewardsClaimed(address,address,uint256,uint256,uint256,uint256)");

const UTILITY_WALLET = "0x4900bfedeee8288f8c14e9f8808d822f3fce8ca3".toLowerCase();

// Direct Database Helpers
async function creditDeposit(userAddress: string, amount: string, txHash: string, proxyAddress: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findFirst({
        where: { txHash }
      });
      if (existing) return;
      
      await tx.ledgerEntry.create({
        data: {
          userAddress: userAddress.toLowerCase(),
          type: 'DEPOSIT',
          amount: parseFloat(amount),
          netAmount: parseFloat(amount),
          fee: 0,
          description: `Direct Deposit to Proxy Wallet (${proxyAddress})`,
          txHash,
          timestamp: new Date()
        }
      });
      console.log(`[Sweeper] Credited deposit of ${amount} ARES to ${userAddress}`);
    });
  } catch (err) {
    console.error(`[Sweeper] Failed to credit deposit for tx ${txHash}:`, err);
  }
}

async function creditExternalDeposit(fromAddress: string, amount: string, txHash: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findFirst({
        where: { txHash }
      });
      if (existing) return;
      
      await tx.ledgerEntry.create({
        data: {
          userAddress: fromAddress.toLowerCase(),
          type: 'DEPOSIT',
          amount: parseFloat(amount),
          netAmount: parseFloat(amount),
          fee: 0,
          description: `Direct Native Deposit to Utility Wallet`,
          txHash,
          timestamp: new Date()
        }
      });
      console.log(`[Sweeper] Credited external native deposit of ${amount} ARES to ${fromAddress}`);
    });
  } catch (err) {
    console.error(`[Sweeper] Failed to credit external deposit for tx ${txHash}:`, err);
  }
}

async function recordPlan(userAddress: string, amount: string, txHash: string, timestamp: number) {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.stakingPlan.findUnique({
        where: { txHash }
      });
      if (existing) return;
      
      // Before recording the plan, accrue yield for user up to this timestamp
      await accrueUserYield(userAddress);

      await tx.stakingPlan.create({
        data: {
          userAddress: userAddress.toLowerCase(),
          amount: parseFloat(amount),
          txHash,
          timestamp: new Date(timestamp * 1000)
        }
      });
      console.log(`[Sweeper] Recorded staking plan of ${amount} ARES for ${userAddress}`);
    });
  } catch (err) {
    console.error(`[Sweeper] Failed to record staking plan for tx ${txHash}:`, err);
  }
}

async function recordSplitClaim(userAddress: string, grossAmount: string, netAmount: string, txHash: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.claimHistory.findFirst({
        where: {
          userAddress: userAddress.toLowerCase(),
          grossAmount: parseFloat(grossAmount),
          destination: 'METAMASK',
          timestamp: {
            gte: new Date(Date.now() - 60000)
          }
        }
      });
      if (existing) return;
      
      // Accrue yield before updating the database claim state
      await accrueUserYield(userAddress);

      // Deduct claimed amount from yieldBalance
      const user = await tx.user.findUnique({
        where: { walletAddress: userAddress.toLowerCase() }
      });
      if (user) {
        const nextYieldBalance = Math.max(0, Number(user.yieldBalance) - parseFloat(grossAmount));
        await tx.user.update({
          where: { walletAddress: userAddress.toLowerCase() },
          data: { yieldBalance: nextYieldBalance }
        });
      }

      await tx.claimHistory.create({
        data: {
          userAddress: userAddress.toLowerCase(),
          grossAmount: parseFloat(grossAmount),
          netAmount: parseFloat(netAmount),
          destination: 'METAMASK',
          timestamp: new Date()
        }
      });
      console.log(`[Sweeper] Recorded MetaMask split claim of ${grossAmount} ARES for ${userAddress}`);
    });
  } catch (err) {
    console.error(`[Sweeper] Failed to record split claim for tx ${txHash}:`, err);
  }
}

async function pollBlockRange() {
  if (!provider) return;
  try {
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock <= lastProcessedBlock) return;
    
    const startBlock = lastProcessedBlock + 1;
    const endBlock = Math.min(currentBlock, lastProcessedBlock + 20);
    
    console.log(`[Sweeper] Scanning blocks #${startBlock} to #${endBlock} for transactions and logs...`);
    
    for (let b = startBlock; b <= endBlock; b++) {
      try {
        const block = await provider.getBlock(b, true);
        if (block && block.prefetchedTransactions) {
          for (const tx of block.prefetchedTransactions) {
            const txHash = tx.hash;
            
            // 1. Scan for direct transfers to the utility wallet EOA
            if (tx.to && tx.to.toLowerCase() === UTILITY_WALLET && tx.value > BigInt(0)) {
              const amountAres = ethers.formatEther(tx.value);
              const fromAddress = tx.from.toLowerCase();
              
              console.log(`[Sweeper] Detected external native deposit of ${amountAres} ARES to utility wallet from ${fromAddress}`);
              await creditExternalDeposit(fromAddress, amountAres, txHash);
            }
            
            // 2. Fetch receipts to check for events
            const receipt = await provider.getTransactionReceipt(txHash);
            if (receipt && receipt.status === 1 && receipt.logs) {
              for (const log of receipt.logs) {
                const topic = log.topics[0];
                
                if (topic === RECEIVED_TOPIC) {
                  const proxyAddress = log.address.toLowerCase();
                  const amountWei = ethers.getBigInt(log.data);
                  const amountAres = ethers.formatEther(amountWei);
                  
                  const user = await prisma.user.findFirst({
                    where: { proxyAddress }
                  });
                  
                  if (user) {
                    await creditDeposit(user.walletAddress, amountAres, txHash, log.address);
                  }
                } 
                else if (topic === PLAN_PURCHASED_TOPIC) {
                  const userAddress = ethers.getAddress('0x' + log.topics[1].substring(26)).toLowerCase();
                  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], log.data);
                  const amountAres = ethers.formatEther(decoded[0]);
                  const timestamp = Number(decoded[1]);
                  
                  await recordPlan(userAddress, amountAres, txHash, timestamp);
                } 
                else if (topic === REWARDS_CLAIMED_TOPIC) {
                  const userAddress = ethers.getAddress('0x' + log.topics[1].substring(26)).toLowerCase();
                  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256', 'uint256', 'uint256'], log.data);
                  const grossAres = ethers.formatEther(decoded[0]);
                  const netAres = ethers.formatEther(decoded[0] - decoded[1]);
                  
                  await recordSplitClaim(userAddress, grossAres, netAres, txHash);
                }
              }
            }
          }
        }
      } catch (blockErr) {
        console.error(`[Sweeper] Error scanning block #${b}:`, blockErr);
      }
    }
    
    lastProcessedBlock = endBlock;
    saveLastBlock(endBlock);
  } catch (err) {
    console.error(`[Sweeper] Poller error:`, err);
  }
}

// Yield accrual daemon loops through all users and updates their yield state
async function accrueYieldForAllUsers() {
  console.log('[Sweeper] Accruing yield for all users...');
  try {
    const users = await prisma.user.findMany();
    for (const user of users) {
      try {
        const result = await accrueUserYield(user.walletAddress);
        if (result && result.accruedThisPeriod > 0) {
          console.log(`[Sweeper] Accrued +${result.accruedThisPeriod.toFixed(6)} ARES yield for ${user.walletAddress}. Total: ${result.yieldBalance.toFixed(6)}`);
        }
      } catch (err) {
        console.error(`[Sweeper] Failed to accrue yield for user ${user.walletAddress}:`, err);
      }
    }
  } catch (err) {
    console.error('[Sweeper] Failed to fetch users for yield accrual:', err);
  }
}

async function main() {
  connectProvider();
  await loadLastBlock();
  
  console.log(`[Sweeper] Direct DB Poller started successfully.`);
  // Poll blockchain blocks every 5 seconds
  setInterval(pollBlockRange, 5000);

  // Accrue yield for all users every 60 seconds
  setInterval(accrueYieldForAllUsers, 60000);
}

main().catch(err => {
  console.error(`[Sweeper] Startup failure:`, err);
  process.exit(1);
});
