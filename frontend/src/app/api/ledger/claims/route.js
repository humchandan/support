import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  const walletAddress = verifyToken(request);
  if (!walletAddress) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { amount } = await request.json();
    const parsedAmount = parseFloat(amount) || 0;
    
    if (parsedAmount <= 0) {
      return Response.json({ error: 'Positive claim amount is required' }, { status: 400 });
    }
    
    // 1. Verify user has active staking plans
    const plans = await prisma.stakingPlan.findMany({
      where: { userAddress: walletAddress }
    });
    const totalDeposited = plans.reduce((acc, p) => acc + Number(p.amount), 0);
    
    if (totalDeposited <= 0) {
      return Response.json({ error: 'Cannot claim rewards without active validation plans.' }, { status: 400 });
    }
    
    // 2. Verify 2.5x payout cap limit
    const maxLimit = totalDeposited * 2.5;
    
    const claimHistory = await prisma.claimHistory.findMany({
      where: { userAddress: walletAddress }
    });
    const totalClaimed = claimHistory.reduce((acc, c) => acc + Number(c.grossAmount), 0);
    
    if (totalClaimed >= maxLimit) {
      return Response.json({ error: 'Lifetime payout limit reached! Please purchase a top-up plan.' }, { status: 400 });
    }
    
    let claimable = parsedAmount;
    if (totalClaimed + parsedAmount > maxLimit) {
      claimable = maxLimit - totalClaimed;
    }
    
    if (claimable <= 0) {
      return Response.json({ error: 'No remaining capacity under current payout cap.' }, { status: 400 });
    }
    
    // 3. Enforce maximum of 4 claims in a rolling 30-day period
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentClaimsCount = await prisma.claimHistory.count({
      where: {
        userAddress: walletAddress,
        destination: 'UTILITY',
        timestamp: {
          gte: thirtyDaysAgo
        }
      }
    });
    
    if (recentClaimsCount >= 4) {
      return Response.json({ error: 'Monthly withdrawal limit reached (4/4 direct claims). Please wait for previous claims to expire.' }, { status: 400 });
    }
    
    // 4. Process claim (deduct 10% fee)
    const fee = claimable * 0.10;
    const netClaimed = claimable - fee;
    
    await prisma.$transaction(async (tx) => {
      // Record Claim History
      await tx.claimHistory.create({
        data: {
          userAddress: walletAddress,
          grossAmount: claimable,
          netAmount: netClaimed,
          destination: 'UTILITY',
          timestamp: new Date()
        }
      });
      
      // Record Ledger entry (credit to user available utility balance)
      await tx.ledgerEntry.create({
        data: {
          userAddress: walletAddress,
          type: 'CLAIM_DIRECT',
          amount: claimable,
          netAmount: netClaimed,
          fee,
          description: 'Direct MLM Staking Claim to Utility Balance',
          timestamp: new Date()
        }
      });

      // Distribute MLM Matching commissions to referrers
      const { distributeMatchingRewards } = await import('@/lib/mlm');
      await distributeMatchingRewards(tx, walletAddress, claimable);
    });
    
    return Response.json({ success: true, claimedAmount: netClaimed, fee });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Claim failed' }, { status: 500 });
  }
}
