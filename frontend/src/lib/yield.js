import { prisma } from './prisma';

/**
 * Calculates and persists yield accrual for a given user.
 * Interest rate: 8.5% per month (based on 30 days = 2,592,000 seconds).
 * Cap: 2.5x of total active staking deposit.
 * 
 * @param {string} walletAddress - The wallet address of the user.
 * @returns {Promise<{yieldBalance: number, lastYieldAccruedAt: Date, accruedThisPeriod: number} | null>}
 */
export async function accrueUserYield(walletAddress) {
  const cleanAddress = walletAddress.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { walletAddress: cleanAddress }
  });
  if (!user) return null;

  const now = new Date();
  const lastAccrued = new Date(user.lastYieldAccruedAt || user.createdAt);
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastAccrued.getTime()) / 1000));

  if (elapsedSeconds <= 0) {
    return {
      yieldBalance: Number(user.yieldBalance),
      lastYieldAccruedAt: user.lastYieldAccruedAt,
      accruedThisPeriod: 0
    };
  }

  // Calculate selfInvestment (sum of all staking plan amounts)
  const plans = await prisma.stakingPlan.findMany({
    where: { userAddress: cleanAddress }
  });
  const selfInvestment = plans.reduce((acc, p) => acc + Number(p.amount), 0);

  if (selfInvestment <= 0) {
    // If no staking plan, just roll forward the timestamp so seconds don't pile up
    await prisma.user.update({
      where: { walletAddress: cleanAddress },
      data: { lastYieldAccruedAt: now }
    });
    return {
      yieldBalance: Number(user.yieldBalance),
      lastYieldAccruedAt: now,
      accruedThisPeriod: 0
    };
  }

  // Calculate total claimed history
  const claims = await prisma.claimHistory.findMany({
    where: { userAddress: cleanAddress }
  });
  const totalClaimed = claims.reduce((acc, c) => acc + Number(c.grossAmount), 0);

  const maxLimit = selfInvestment * 2.5;
  const currentTotalAccrued = Number(user.yieldBalance);

  if (totalClaimed + currentTotalAccrued >= maxLimit) {
    // Already hit or exceeded 2.5x lifetime payout cap
    await prisma.user.update({
      where: { walletAddress: cleanAddress },
      data: { lastYieldAccruedAt: now }
    });
    return {
      yieldBalance: currentTotalAccrued,
      lastYieldAccruedAt: now,
      accruedThisPeriod: 0
    };
  }

  // 8.5% per month (calculated per second)
  const ratePerSec = (selfInvestment * 0.085) / 2592000.0;
  let accruedThisPeriod = elapsedSeconds * ratePerSec;

  // Enforce 2.5x lifetime limit cap
  if (totalClaimed + currentTotalAccrued + accruedThisPeriod > maxLimit) {
    accruedThisPeriod = maxLimit - (totalClaimed + currentTotalAccrued);
  }

  const nextBalance = currentTotalAccrued + accruedThisPeriod;

  await prisma.user.update({
    where: { walletAddress: cleanAddress },
    data: {
      yieldBalance: nextBalance,
      lastYieldAccruedAt: now
    }
  });

  return {
    yieldBalance: nextBalance,
    lastYieldAccruedAt: now,
    accruedThisPeriod
  };
}
