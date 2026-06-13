import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests = await prisma.utilityRequest.findMany({
      where: { userAddress: walletAddress.toLowerCase() },
      orderBy: { timestamp: 'desc' }
    });
    return Response.json({ requests });
  } catch (err) {
    console.error("Failed to fetch user utility requests:", err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
