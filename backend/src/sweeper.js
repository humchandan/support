const { ethers } = require('ethers');
const { Worker } = require('bullmq');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const { sweepQueue, connection } = require('./queue');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = new URL(process.env.DATABASE_URL);
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.replace(/^\//, '')
});
const prisma = new PrismaClient({ adapter });
const RPC_URL = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'http://127.0.0.1:8545';
const LAST_BLOCK_FILE = path.join(__dirname, '../data/last_block.txt');

// Ensure data folder exists
if (!fs.existsSync(path.dirname(LAST_BLOCK_FILE))) {
  fs.mkdirSync(path.dirname(LAST_BLOCK_FILE), { recursive: true });
}

let provider = null;
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
    const currentBlock = await provider.getBlockNumber();
    lastProcessedBlock = currentBlock;
    saveLastBlock(currentBlock);
    console.log(`[Sweeper] Initialized last processed block to current: ${lastProcessedBlock}`);
  } catch (err) {
    console.error(`[Sweeper] Failed to fetch current block from RPC:`, err);
    lastProcessedBlock = 0;
  }
}

function saveLastBlock(blockNumber) {
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

async function pollBlockRange() {
  try {
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock <= lastProcessedBlock) return;
    
    const startBlock = lastProcessedBlock + 1;
    const endBlock = Math.min(currentBlock, lastProcessedBlock + 5000);
    
    console.log(`[Sweeper] Querying logs from block #${startBlock} to #${endBlock}...`);
    
    const logs = await provider.getLogs({
      fromBlock: startBlock,
      toBlock: endBlock,
      topics: [[RECEIVED_TOPIC, PLAN_PURCHASED_TOPIC, REWARDS_CLAIMED_TOPIC]]
    });
    
    for (const log of logs) {
      try {
        const txHash = log.transactionHash;
        const topic = log.topics[0];
        
        if (topic === RECEIVED_TOPIC) {
          const proxyAddress = log.address.toLowerCase();
          const amountWei = ethers.getBigInt(log.data);
          const amountAres = ethers.formatEther(amountWei);
          
          const user = await prisma.user.findFirst({
            where: { proxyAddress }
          });
          
          if (user) {
            await sweepQueue.add(
              'credit-deposit',
              {
                userAddress: user.walletAddress,
                amount: amountAres,
                txHash,
                proxyAddress: log.address
              },
              {
                jobId: `dep-${txHash}`,
                attempts: 5,
                backoff: { type: 'exponential', delay: 5000 }
              }
            );
            console.log(`[Sweeper] Enqueued deposit credit job for tx ${txHash}`);
          }
        } 
        else if (topic === PLAN_PURCHASED_TOPIC) {
          const userAddress = ethers.getAddress('0x' + log.topics[1].substring(26)).toLowerCase();
          
          // Decode data: amount (uint256), timestamp (uint256)
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], log.data);
          const amountAres = ethers.formatEther(decoded[0]);
          const timestamp = Number(decoded[1]);
          
          await sweepQueue.add(
            'record-plan',
            {
              userAddress,
              amount: amountAres,
              txHash,
              timestamp
            },
            {
              jobId: `plan-${txHash}`,
              attempts: 5,
              backoff: { type: 'exponential', delay: 5000 }
            }
          );
          console.log(`[Sweeper] Enqueued staking plan record job for tx ${txHash}`);
        } 
        else if (topic === REWARDS_CLAIMED_TOPIC) {
          const userAddress = ethers.getAddress('0x' + log.topics[1].substring(26)).toLowerCase();
          
          // Decode data: grossAmount, feeAmount, primaryAmount, utilityAmount
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256', 'uint256', 'uint256'], log.data);
          const grossAres = ethers.formatEther(decoded[0]);
          const netAres = ethers.formatEther(decoded[0] - decoded[1]);
          
          await sweepQueue.add(
            'record-split-claim',
            {
              userAddress,
              grossAmount: grossAres,
              netAmount: netAres,
              txHash
            },
            {
              jobId: `claim-${txHash}`,
              attempts: 5,
              backoff: { type: 'exponential', delay: 5000 }
            }
          );
          console.log(`[Sweeper] Enqueued split claim record job for tx ${txHash}`);
        }
      } catch (err) {
        console.error(`[Sweeper] Error processing log:`, err);
      }
    }
    
    lastProcessedBlock = endBlock;
    saveLastBlock(endBlock);
  } catch (err) {
    console.error(`[Sweeper] Poller error:`, err);
  }
}

// Initialize BullMQ Worker to process events in order
const worker = new Worker('sweep-queue', async (job) => {
  const { userAddress, txHash } = job.data;
  
  if (job.name === 'credit-deposit') {
    const { amount, proxyAddress } = job.data;
    
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
      console.log(`[Worker] Credited deposit of ${amount} ARES to ${userAddress}`);
    });
  } 
  else if (job.name === 'record-plan') {
    const { amount, timestamp } = job.data;
    
    await prisma.$transaction(async (tx) => {
      const existing = await tx.stakingPlan.findUnique({
        where: { txHash }
      });
      if (existing) return;
      
      await tx.stakingPlan.create({
        data: {
          userAddress: userAddress.toLowerCase(),
          amount: parseFloat(amount),
          txHash,
          timestamp: new Date(timestamp * 1000)
        }
      });
      console.log(`[Worker] Recorded staking plan of ${amount} ARES for ${userAddress}`);
    });
  } 
  else if (job.name === 'record-split-claim') {
    const { grossAmount, netAmount } = job.data;
    
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
      
      await tx.claimHistory.create({
        data: {
          userAddress: userAddress.toLowerCase(),
          grossAmount: parseFloat(grossAmount),
          netAmount: parseFloat(netAmount),
          destination: 'METAMASK',
          timestamp: new Date()
        }
      });
      console.log(`[Worker] Recorded MetaMask split claim of ${grossAmount} ARES for ${userAddress}`);
    });
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err);
});

async function main() {
  connectProvider();
  await loadLastBlock();
  
  console.log(`[Sweeper] Poller started successfully.`);
  setInterval(pollBlockRange, 5000);
}

main().catch(err => {
  console.error(`[Sweeper] Startup failure:`, err);
  process.exit(1);
});
