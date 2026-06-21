import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // 1. Fetch all ledger entries for the user
    const entries = await prisma.ledgerEntry.findMany({
      where: { userAddress: walletAddress },
      orderBy: { timestamp: 'desc' }
    });
    
    // 2. Calculate balance dynamically
    let balance = 0;
    entries.forEach(entry => {
      const amt = Number(entry.amount);
      const net = Number(entry.netAmount);
      
      if (
        entry.type === 'DEPOSIT' || 
        entry.type === 'TRANSFER_IN' || 
        entry.type === 'CLAIM_DIRECT' ||
        entry.type === 'CLAIM_METAMASK_SPLIT' ||
        entry.type === 'NETWORK_REDEEM' ||
        entry.type === 'SPEND_REFUND'
      ) {
        balance += net;
      } else if (
        entry.type === 'SPEND' ||
        entry.type === 'SPEND_PENDING' ||
        entry.type === 'TRANSFER_OUT'
      ) {
        balance -= amt;
      }
    });
    
    return Response.json({
      balance: Math.max(0, balance),
      transactions: entries.map(e => ({
        id: e.id,
        type: e.type,
        amount: Number(e.amount),
        netAmount: Number(e.netAmount),
        fee: Number(e.fee),
        description: e.description,
        txHash: e.txHash,
        timestamp: e.timestamp
      }))
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}
