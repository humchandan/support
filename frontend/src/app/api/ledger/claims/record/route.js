import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { accrueUserYield } from '@/lib/yield';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { distributeMatchingRewards } from '@/lib/mlm';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { txHash, amount } = await request.json();
    const grossAmount = parseFloat(amount) || 0;

    if (!txHash || grossAmount <= 0) {
      return Response.json({ error: 'txHash and positive amount are required' }, { status: 400 });
    }

    // 1. Check if this txHash is already registered in LedgerEntry
    const existingLedger = await prisma.ledgerEntry.findFirst({
      where: { txHash }
    });
    if (existingLedger) {
      return Response.json({ error: 'Transaction already registered' }, { status: 400 });
    }

    // 2. Fetch contract address from public JSON artifact
    const portalJsonPath = path.join(process.cwd(), 'public/contracts/AriesSupportPortal.json');
    if (!fs.existsSync(portalJsonPath)) {
      return Response.json({ error: 'Contract metadata not found' }, { status: 500 });
    }
    const portalJson = JSON.parse(fs.readFileSync(portalJsonPath, 'utf8'));
    const portalAddress = portalJson.address.toLowerCase();

    // 3. Query the blockchain RPC to verify the claim transaction
    const rpcUrl = process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'https://rpc.arieschain.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let tx;
    let receipt;
    try {
      tx = await provider.getTransaction(txHash);
      receipt = await provider.getTransactionReceipt(txHash);
    } catch (err) {
      return Response.json({ error: 'Failed to verify transaction on-chain' }, { status: 400 });
    }

    if (!tx || !receipt) {
      return Response.json({ error: 'Transaction not found on-chain' }, { status: 400 });
    }

    // Verify it succeeded
    if (receipt.status !== 1) {
      return Response.json({ error: 'Transaction failed on-chain' }, { status: 400 });
    }

    // Verify target matches AriesSupportPortal
    if (tx.to?.toLowerCase() !== portalAddress) {
      return Response.json({ error: 'Transaction target does not match AriesSupportPortal' }, { status: 400 });
    }

    // Verify sender matches walletAddress
    if (tx.from?.toLowerCase() !== walletAddress.toLowerCase()) {
      return Response.json({ error: 'Transaction sender does not match your wallet address' }, { status: 400 });
    }

    // Calculate 50/50 net splits and 10% fee
    const fee = grossAmount * 0.10;
    const netAmount = grossAmount - fee;
    const metamaskNet = netAmount * 0.50;
    const utilityNet = netAmount * 0.50;

    // 4. Save to Database and Distribute matching rewards
    await prisma.$transaction(async (dbTx) => {
      // Accrue yield up to this instant
      await accrueUserYield(walletAddress);

      // Fetch user to get current yieldBalance and deduct the grossAmount
      const user = await dbTx.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() }
      });
      if (user) {
        const nextYieldBalance = Math.max(0, Number(user.yieldBalance) - grossAmount);
        await dbTx.user.update({
          where: { walletAddress: walletAddress.toLowerCase() },
          data: { yieldBalance: nextYieldBalance }
        });
      }

      // Record MetaMask claim history
      await dbTx.claimHistory.create({
        data: {
          userAddress: walletAddress.toLowerCase(),
          grossAmount: grossAmount,
          netAmount: netAmount,
          destination: 'METAMASK_50_50',
          timestamp: new Date()
        }
      });

      // Record Ledger entry for the 50% credited to utility
      await dbTx.ledgerEntry.create({
        data: {
          userAddress: walletAddress.toLowerCase(),
          type: 'CLAIM_METAMASK_SPLIT',
          amount: grossAmount,
          netAmount: utilityNet,
          fee: fee,
          description: `MetaMask 50/50 Payout split: ${metamaskNet.toFixed(2)} ARES to MetaMask, ${utilityNet.toFixed(2)} ARES to Utility Ledger.`,
          txHash: txHash,
          timestamp: new Date()
        }
      });

      // Distribute MLM Matching commissions upwards to sponsor network
      await distributeMatchingRewards(dbTx, walletAddress, grossAmount);
    });

    return Response.json({ success: true, netAmount, metamaskNet, utilityNet });
  } catch (err) {
    console.error('Failed to record on-chain claim:', err);
    return Response.json({ error: 'Failed to record claim' }, { status: 500 });
  }
}
