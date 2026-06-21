import { prisma } from './prisma';

/**
 * Traverses up to 10 levels of referrers and allocates matching network commissions.
 * This runs within a Prisma transaction context (tx).
 */
export async function distributeMatchingRewards(tx, userAddress, grossClaimAmount) {
  try {
    const allUsers = await tx.user.findMany();
    const dbTiers = await tx.mlmTier.findMany();
    const dbLevels = await tx.mlmLevel.findMany();

    // User lookup map: address -> user
    const userMap = {};
    allUsers.forEach(u => {
      userMap[u.walletAddress.toLowerCase()] = u;
    });

    // Level configuration map: level_num -> levelConfig
    const levelMap = {};
    dbLevels.forEach(l => {
      levelMap[l.level] = l;
    });

    // Tiers map: tierName -> tierConfig
    const tierMap = {};
    dbTiers.forEach(t => {
      tierMap[t.name] = t;
    });

    let currentAddress = userAddress.toLowerCase();
    let level = 1;

    while (level <= 10) {
      const currentUser = userMap[currentAddress];
      if (!currentUser) break; // Reached end of hierarchy

      const sponsorAddress = currentUser.sponsorAddress?.toLowerCase();
      if (!sponsorAddress || sponsorAddress === currentAddress || sponsorAddress === '0x0000000000000000000000000000000000000000') {
        break; // Reached admin root or invalid sponsor
      }

      const sponsorUser = userMap[sponsorAddress];
      if (!sponsorUser) break;

      const lvlConfig = levelMap[level];
      if (lvlConfig) {
        const sponsorRank = sponsorUser.rank || 'Default';
        const sponsorTier = tierMap[sponsorRank];

        // Check level depth eligibility
        const unlockedLevels = sponsorTier ? Number(sponsorTier.unlockedLevels) : 1;

        if (unlockedLevels >= level) {
          const bonusPct = parseFloat(lvlConfig.bonus.toString()) / 100;
          const rewardAmount = grossClaimAmount * bonusPct;

          if (rewardAmount > 0) {
            // Write reward record
            await tx.networkEarning.create({
              data: {
                userAddress: sponsorAddress,
                fromAddress: userAddress.toLowerCase(),
                level: level,
                amount: rewardAmount,
                isClaimed: false
              }
            });
          }
        }
      }

      // Move up to the next upline sponsor
      currentAddress = sponsorAddress;
      level++;
    }
  } catch (err) {
    console.error('Error distributing matching rewards:', err);
    throw err; // Propagate to rollback tx if something goes wrong
  }
}
