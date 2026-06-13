import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const ADMIN_ADDRESSES = [
  '0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17'
];

function isAdmin(walletAddress) {
  if (!walletAddress) return false;
  return ADMIN_ADDRESSES.includes(walletAddress.toLowerCase());
}

export async function GET(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tiers = await prisma.mlmTier.findMany({ orderBy: { id: 'asc' } });
    const levels = await prisma.mlmLevel.findMany({ orderBy: { level: 'asc' } });
    return Response.json({ tiers, levels });
  } catch (err) {
    console.error("Failed to load MLM configurations:", err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress || !isAdmin(walletAddress)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'tier') {
      const { id, minSelfInvestment, minDirects, minTeamVolume, unlockedLevels } = body;
      const updated = await prisma.mlmTier.update({
        where: { id: parseInt(id) },
        data: {
          minSelfInvestment: parseFloat(minSelfInvestment),
          minDirects: parseInt(minDirects),
          minTeamVolume: parseFloat(minTeamVolume),
          unlockedLevels: parseInt(unlockedLevels)
        }
      });
      return Response.json({ success: true, tier: updated });
    } 
    
    if (type === 'level') {
      const { id, bonus, requiredRank } = body;
      const updated = await prisma.mlmLevel.update({
        where: { id: parseInt(id) },
        data: {
          bonus: parseFloat(bonus),
          requiredRank
        }
      });
      return Response.json({ success: true, level: updated });
    }

    return Response.json({ error: 'Invalid config type' }, { status: 400 });
  } catch (err) {
    console.error("Failed to update MLM configurations:", err);
    return Response.json({ error: 'Failed to save configuration' }, { status: 500 });
  }
}
