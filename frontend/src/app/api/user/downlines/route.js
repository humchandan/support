import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // 1. Fetch direct downlines
    const downlines = await prisma.user.findMany({
      where: { sponsorAddress: walletAddress }
    });
    
    // 2. Fetch all plans and users to map team volumes
    const allUsers = await prisma.user.findMany();
    const allPlans = await prisma.stakingPlan.findMany();
    
    // Maps
    const sponsorMap = {};
    allUsers.forEach(u => {
      const sp = u.sponsorAddress.toLowerCase();
      if (!sponsorMap[sp]) sponsorMap[sp] = [];
      sponsorMap[sp].push(u);
    });
    
    const investmentMap = {};
    allPlans.forEach(p => {
      const addr = p.userAddress.toLowerCase();
      if (!investmentMap[addr]) investmentMap[addr] = 0;
      investmentMap[addr] += Number(p.amount);
    });
    
    // Recursive helper to calculate volume for a specific downline user
    function getDownlineVolume(downlineAddr) {
      let volume = 0;
      const visited = new Set([downlineAddr.toLowerCase()]);
      
      function traverse(addr, currentLevel) {
        if (currentLevel > 10) return;
        const cleanAddr = addr.toLowerCase();
        const children = sponsorMap[cleanAddr] || [];
        children.forEach(child => {
          const childAddr = child.walletAddress.toLowerCase();
          if (visited.has(childAddr)) return; // Loop protection
          visited.add(childAddr);
          
          const childInvestment = investmentMap[childAddr] || 0;
          volume += childInvestment;
          traverse(childAddr, currentLevel + 1);
        });
      }
      
      traverse(downlineAddr, 1);
      return volume;
    }
    
    // Format list
    const formattedDownlines = downlines.map(d => {
      const dAddr = d.walletAddress.toLowerCase();
      const selfStaking = investmentMap[dAddr] || 0;
      const teamVolume = getDownlineVolume(dAddr);
      const directsCount = (sponsorMap[dAddr] || []).length;
      
      return {
        name: d.name,
        mobile: d.mobile,
        walletAddress: d.walletAddress,
        selfInvestment: selfStaking,
        teamVolume: teamVolume,
        directs: directsCount
      };
    });
    
    return Response.json({ downlines: formattedDownlines });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to load downlines' }, { status: 500 });
  }
}
