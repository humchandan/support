import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { accrueUserYield } from '@/lib/yield';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { txHash, amount } = await request.json();

    if (!txHash || !amount) {
      return Response.json({ error: 'txHash and amount are required' }, { status: 400 });
    }

    // 1. Check if this txHash is already registered
    const existing = await prisma.stakingPlan.findUnique({
      where: { txHash }
    });
    if (existing) {
      return Response.json({ error: 'Transaction already registered' }, { status: 400 });
    }

    // 2. Fetch contract address from public/contracts/AriesSupportPortal.json
    const contractPath = path.join(process.cwd(), 'public/contracts/AriesSupportPortal.json');
    if (!fs.existsSync(contractPath)) {
      return Response.json({ error: 'Contract metadata not found' }, { status: 500 });
    }
    const contractMeta = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const portalAddress = contractMeta.address.toLowerCase();

    // 3. Query the blockchain RPC to verify the transaction details
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

    // Verify the transaction was sent to the correct AriesSupportPortal address
    if (tx.to?.toLowerCase() !== portalAddress) {
      return Response.json({ error: 'Transaction target does not match AriesSupportPortal' }, { status: 400 });
    }

    // Verify sender
    if (tx.from?.toLowerCase() !== walletAddress.toLowerCase()) {
      return Response.json({ error: 'Transaction sender does not match your wallet address' }, { status: 400 });
    }

    // Verify value
    const txValEther = ethers.formatEther(tx.value);
    if (Math.abs(parseFloat(txValEther) - parseFloat(amount)) > 0.01) {
      return Response.json({ error: 'Transaction value does not match plan amount' }, { status: 400 });
    }

    // 4. Accrue yield up to this instant using the old selfInvestment before registering the new plan
    await accrueUserYield(walletAddress);

    // 5. Create the staking plan record in PostgreSQL
    const plan = await prisma.stakingPlan.create({
      data: {
        userAddress: walletAddress.toLowerCase(),
        amount: parseFloat(amount),
        txHash
      }
    });

    return Response.json({ success: true, plan });
  } catch (err) {
    console.error('Staking plan registration failed:', err);
    return Response.json({ error: 'Failed to register staking plan' }, { status: 500 });
  }
}
