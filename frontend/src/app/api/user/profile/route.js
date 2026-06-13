import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });
    
    if (!user) {
      return Response.json({ registered: false });
    }
    
    // Count direct downlines
    const directsCount = await prisma.user.count({
      where: { sponsorAddress: walletAddress }
    });
    
    // Fetch recursive team volume and direct downline lists
    const teamStats = await calculateTeamVolumeAndDirects(walletAddress);
    
    // Fetch total deposited staking from smart contracts / database
    const plans = await prisma.stakingPlan.findMany({
      where: { userAddress: walletAddress },
      orderBy: { timestamp: 'desc' }
    });
    const totalDeposited = plans.reduce((acc, p) => acc + Number(p.amount), 0);
    
    // Fetch claim history
    const claims = await prisma.claimHistory.findMany({
      where: { userAddress: walletAddress }
    });
    const totalClaimed = claims.reduce((acc, c) => acc + Number(c.grossAmount), 0);
    
    // Update user rank in database if it changed
    const currentRankName = await getMlmRankName(totalDeposited, directsCount, teamStats.teamVolume);
    if (user.rank !== currentRankName) {
      await prisma.user.update({
        where: { walletAddress },
        data: { rank: currentRankName }
      });
      user.rank = currentRankName;
    }
    
    return Response.json({
      registered: true,
      user: {
        walletAddress: user.walletAddress,
        name: user.name,
        mobile: user.mobile,
        sponsorAddress: user.sponsorAddress,
        proxyAddress: user.proxyAddress,
        rank: user.rank,
        createdAt: user.createdAt,
        directs: directsCount,
        teamVolume: teamStats.teamVolume,
        downlinesList: teamStats.downlinesList,
        selfInvestment: totalDeposited,
        stakingPlans: plans.map(p => ({
          amount: Number(p.amount),
          txHash: p.txHash,
          timestamp: p.timestamp
        })),
        totalClaimed: totalClaimed
      }
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { proxyAddress } = await request.json();
    if (!proxyAddress) {
      return Response.json({ error: 'Proxy address is required' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { walletAddress },
      data: { proxyAddress: proxyAddress.toLowerCase() }
    });

    return Response.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Failed to update proxy address:', err);
    return Response.json({ error: 'Failed to update proxy address' }, { status: 500 });
  }
}

// Helper to determine MLM Rank Name based on parameters dynamically
async function getMlmRankName(selfInvestment, directs, teamVolume) {
  try {
    const dbTiers = await prisma.mlmTier.findMany({
      orderBy: { minSelfInvestment: 'asc' }
    });
    
    const MLM_TIERS = dbTiers.length > 0 ? dbTiers.map(t => ({
      name: t.name,
      minSelfInvestment: Number(t.minSelfInvestment),
      minDirects: t.minDirects,
      minTeamVolume: Number(t.minTeamVolume)
    })) : [
      { name: "Default", minSelfInvestment: 100, minDirects: 0, minTeamVolume: 0 },
      { name: "Bronze Leader", minSelfInvestment: 2000, minDirects: 2, minTeamVolume: 10000 },
      { name: "Silver Leader", minSelfInvestment: 5000, minDirects: 4, minTeamVolume: 50000 },
      { name: "Gold Leader", minSelfInvestment: 10000, minDirects: 6, minTeamVolume: 150000 },
      { name: "Diamond Leader", minSelfInvestment: 25000, minDirects: 8, minTeamVolume: 500000 },
      { name: "Crown Leader", minSelfInvestment: 50000, minDirects: 10, minTeamVolume: 1000000 }
    ];

    for (let i = MLM_TIERS.length - 1; i >= 0; i--) {
      const tier = MLM_TIERS[i];
      if (
        selfInvestment >= tier.minSelfInvestment &&
        directs >= tier.minDirects &&
        teamVolume >= tier.minTeamVolume
      ) {
        return tier.name;
      }
    }
    return MLM_TIERS[0].name;
  } catch (e) {
    console.error("Failed to query dynamic MLM tiers:", e);
    return "Default";
  }
}

async function calculateTeamVolumeAndDirects(userAddress) {
  const allUsers = await prisma.user.findMany();
  
  // Create sponsor lookup map
  const sponsorMap = {};
  allUsers.forEach(u => {
    const sp = u.sponsorAddress.toLowerCase();
    if (!sponsorMap[sp]) sponsorMap[sp] = [];
    sponsorMap[sp].push(u);
  });
  
  // Fetch all staking plans
  const allPlans = await prisma.stakingPlan.findMany();
  const investmentMap = {};
  allPlans.forEach(p => {
    const addr = p.userAddress.toLowerCase();
    if (!investmentMap[addr]) investmentMap[addr] = 0;
    investmentMap[addr] += Number(p.amount);
  });
  
  let teamVolume = 0;
  let downlinesList = [];
  
  function traverse(addr, currentLevel) {
    if (currentLevel > 10) return;
    const children = sponsorMap[addr.toLowerCase()] || [];
    
    children.forEach(child => {
      const childAddr = child.walletAddress.toLowerCase();
      const childInvestment = investmentMap[childAddr] || 0;
      
      teamVolume += childInvestment;
      
      if (currentLevel === 1) {
        downlinesList.push(childAddr);
      }
      
      traverse(childAddr, currentLevel + 1);
    });
  }
  
  traverse(userAddress, 1);
  
  return { teamVolume, downlinesList };
}
