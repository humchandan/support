import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userAddr = walletAddress.toLowerCase();

    // 1. Fetch user's network matching earnings
    const earnings = await prisma.networkEarning.findMany({
      where: { userAddress: userAddr },
      orderBy: { timestamp: 'desc' }
    });

    const totalEarned = earnings.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const availableEarned = earnings.filter(e => !e.isClaimed).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const claimedEarned = earnings.filter(e => e.isClaimed).reduce((acc, curr) => acc + Number(curr.amount), 0);

    return Response.json({
      success: true,
      stats: {
        totalEarned,
        availableEarned,
        claimedEarned
      },
      earningsHistory: earnings.map(e => ({
        id: e.id,
        fromAddress: e.fromAddress,
        level: e.level,
        amount: Number(e.amount),
        isClaimed: e.isClaimed,
        txHash: e.txHash,
        timestamp: e.timestamp
      }))
    });
  } catch (err) {
    console.error('Failed to load network stats:', err);
    return Response.json({ error: 'Failed to load network stats' }, { status: 500 });
  }
}
