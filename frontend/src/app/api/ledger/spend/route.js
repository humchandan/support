import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { amount, description } = await request.json();
    const spendAmount = parseFloat(amount) || 0;

    if (spendAmount <= 0) {
      return Response.json({ error: 'Invalid spend amount' }, { status: 400 });
    }

    // 1. Calculate user balance dynamically
    const entries = await prisma.ledgerEntry.findMany({
      where: { userAddress: walletAddress }
    });

    let currentBalance = 0;
    entries.forEach(entry => {
      const amt = Number(entry.amount);
      const net = Number(entry.netAmount);
      
      if (entry.type === 'DEPOSIT' || entry.type === 'TRANSFER_IN' || entry.type === 'CLAIM_DIRECT') {
        currentBalance += net;
      } else {
        currentBalance -= amt;
      }
    });

    if (currentBalance < spendAmount) {
      return Response.json({ error: 'Insufficient utility credit balance' }, { status: 400 });
    }

    // 2. Record the spend event in the ledger
    const newEntry = await prisma.ledgerEntry.create({
      data: {
        userAddress: walletAddress,
        type: 'SPEND',
        amount: spendAmount,
        netAmount: spendAmount,
        fee: 0,
        description: description || 'Utility Portal Spending',
        timestamp: new Date()
      }
    });

    return Response.json({
      success: true,
      newBalance: Math.max(0, currentBalance - spendAmount),
      transaction: {
        id: newEntry.id,
        type: newEntry.type,
        amount: Number(newEntry.amount),
        description: newEntry.description,
        timestamp: newEntry.timestamp
      }
    });
  } catch (err) {
    console.error("Failed to process utility spend transaction:", err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
