import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }) {
  const { year, month } = await params;
  return {
    title: `Aries Promotions — ${month} ${year}`,
    description: `Stay tuned for upcoming promotions, validator incentives, and staking milestones on the Aries blockchain for ${month} ${year}.`,
  };
}

export default async function MonthPromotions({ params }) {
  const { year, month } = await params;

  if (year === '2026' && (month === 'June' || month === 'July' || month.toLowerCase() === 'june' || month.toLowerCase() === 'july')) {
    redirect(`/promotions/2026/June-July`);
  }

  const ignoredWallets = [
    '0x6F8F3CCd90d63d24Ed54270c03803CF12DbB6A32',
    '0xD01c1BFC96E22A9470C186E69E0A97e18EfF23e6'
  ];
  const allIgnored = Array.from(new Set([
    ...ignoredWallets,
    ...ignoredWallets.map(w => w.toLowerCase()),
    ...ignoredWallets.map(w => w.toUpperCase())
  ]));

  // 1. Query total business achieved (sustenance model staked)
  let totalBusiness = 0;
  try {
    const totalStakedResult = await prisma.stakingPlan.aggregate({
      where: {
        NOT: {
          userAddress: {
            in: allIgnored
          }
        }
      },
      _sum: {
        amount: true
      }
    });
    totalBusiness = Number(totalStakedResult._sum.amount || 0);
  } catch (err) {
    console.error("Failed to query total staking business:", err);
  }

  // 2. Query all users and staking plans to calculate leaderboards dynamically
  let top21Leaders = [];
  try {
    const allUsers = await prisma.user.findMany();
    const allPlans = await prisma.stakingPlan.findMany();

    // Filter out ignored wallets
    const activeUsers = allUsers.filter(u => !allIgnored.includes(u.walletAddress.toLowerCase()));
    const activePlans = allPlans.filter(p => !allIgnored.includes(p.userAddress.toLowerCase()));

    // Map user address -> self staking amount
    const investmentMap = {};
    activePlans.forEach(p => {
      const addr = p.userAddress.toLowerCase();
      if (!investmentMap[addr]) investmentMap[addr] = 0;
      investmentMap[addr] += Number(p.amount);
    });

    // Map sponsor address -> array of direct recruit users
    const sponsorMap = {};
    activeUsers.forEach(u => {
      const sp = u.sponsorAddress.toLowerCase();
      if (!sponsorMap[sp]) sponsorMap[sp] = [];
      sponsorMap[sp].push(u);
    });

    // Recursive team volume calculator (up to 10 levels)
    const getTeamVolume = (userAddress) => {
      let teamVolume = 0;
      const visited = new Set([userAddress.toLowerCase()]);

      const traverse = (addr, level) => {
        if (level > 10) return;
        const cleanAddr = addr.toLowerCase();
        const children = sponsorMap[cleanAddr] || [];

        children.forEach(child => {
          const childAddr = child.walletAddress.toLowerCase();
          if (visited.has(childAddr)) return;
          visited.add(childAddr);

          const childInv = investmentMap[childAddr] || 0;
          teamVolume += childInv;

          traverse(childAddr, level + 1);
        });
      };

      traverse(userAddress, 1);
      return teamVolume;
    };

    // Calculate details for each active user
    const leaders = activeUsers.map(u => {
      const uAddr = u.walletAddress.toLowerCase();
      const selfInv = investmentMap[uAddr] || 0;
      const teamVol = getTeamVolume(u.walletAddress);
      
      const rank = u.rank || 'Default';
      let rankPrecedence = 0;
      if (rank === 'Crown Leader') rankPrecedence = 5;
      else if (rank === 'Diamond Leader') rankPrecedence = 4;
      else if (rank === 'Gold Leader') rankPrecedence = 3;
      else if (rank === 'Silver Leader') rankPrecedence = 2;
      else if (rank === 'Bronze Leader') rankPrecedence = 1;

      // Prize determination based on team volume
      let prize = 'Qualified Partner';
      if (teamVol >= 500000) prize = 'Smart E-Scooter / Bike 🛵';
      else if (teamVol >= 250000) prize = 'Premium Laptop Pro 💻';
      else if (teamVol >= 100000) prize = 'Premium Mobile Phone 📱';
      else if (teamVol >= 50000) prize = 'Apple iPad Air 📟';
      else if (teamVol >= 25000) prize = 'Aries Edition Smart Watch ⌚';
      else if (teamVol >= 10000) prize = 'Fast Charging Power Bank 🔋';

      return {
        name: u.name,
        walletAddress: u.walletAddress,
        rank,
        rankPrecedence,
        selfInvestment: selfInv,
        teamVolume: teamVol,
        prize
      };
    });

    // Sort: Higher rank first, then higher team volume descending
    top21Leaders = leaders
      .sort((a, b) => {
        if (b.rankPrecedence !== a.rankPrecedence) {
          return b.rankPrecedence - a.rankPrecedence;
        }
        return b.teamVolume - a.teamVolume;
      })
      .slice(0, 21);

  } catch (err) {
    console.error("Failed to build leaderboards:", err);
  }

  // 3. Fetch Event Media pushed by the admin
  let eventMedia = [];
  try {
    eventMedia = await prisma.eventMedia.findMany({
      orderBy: { createdAt: 'desc' }
    });
  } catch (err) {
    console.error("Failed to query event media:", err);
  }

  return (
    <div className="min-h-screen bg-[#030303] text-[#fafafa] font-sans antialiased selection:bg-zinc-800 selection:text-white relative pb-32">
      {/* Background Dots Pattern & Ambient Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-zinc-800/10 blur-[120px] pointer-events-none" />

      {/* Styled inline elements */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        body {
          font-family: 'Outfit', sans-serif;
          background-color: #030303;
        }
      `}} />

      {/* Top Header */}
      <header className="w-full border-b border-zinc-900 bg-[#030303]/80 backdrop-blur-md sticky top-0 z-50 py-5">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <Link 
            id="promotions-brand-link"
            href="/promotions"
            className="text-lg font-bold tracking-tight text-white hover:text-white transition-colors"
          >
            Aries<span className="text-zinc-500">.</span>Promotions
          </Link>
          <Link 
            id="back-to-year-link"
            href={`/promotions/${year}`}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 border border-zinc-900 hover:border-zinc-800 bg-zinc-950/40 rounded-full"
          >
            <i className="fa-solid fa-arrow-left text-[10px]"></i> Back to {year}
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 pt-24">
        
        {/* Banner Section */}
        <section className="bg-[#09090b]/85 border border-zinc-900 rounded-3xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden mb-16 text-center">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />
          
          <span className="px-3 py-1 text-[10px] font-bold text-zinc-400 bg-zinc-900 rounded-full border border-zinc-800 uppercase tracking-wider">
            {month} {year} • Achievements Page
          </span>
          
          <h2 className="text-3xl md:text-4xl font-extrabold mt-6 mb-4 tracking-tight leading-tight text-white uppercase">
            Stay tuned for <br/>
            <span className="text-white font-black">
              Upcoming Promotions!
            </span>
          </h2>
          
          <p className="text-zinc-500 text-sm md:text-base font-light max-w-xl mx-auto leading-relaxed">
            Our next network incentive campaign and staking booster program is currently under final review by the consensus team. Prepare your validators and staking pools!
          </p>
        </section>

        {/* Live Total Business Achieved Status Card */}
        <section className="bg-[#09090b]/85 border border-zinc-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Sovereign sustenance model staked
            </h3>
            <h4 className="text-xl md:text-2xl font-bold text-white mt-1">
              Total ARES Staked
            </h4>
          </div>
          <div className="text-left md:text-right relative z-10">
            <span className="text-3xl md:text-4xl font-extrabold text-white font-mono tracking-tight">
              {totalBusiness.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm font-semibold text-zinc-500 ml-2">ARES</span>
          </div>
        </section>

        {/* Top 21 leaders leaderboard */}
        <section className="mb-16">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 tracking-tight">
            <i className="fa-solid fa-trophy text-yellow-500 text-sm"></i> Top 21 Network Leaders & Prize Achievers
          </h3>
          <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/40 text-xs font-bold text-zinc-500 uppercase">
                    <th className="py-4 px-6">Rank</th>
                    <th className="py-4 px-6">Leader Name</th>
                    <th className="py-4 px-6">MLM Rank</th>
                    <th className="py-4 px-6">Team Volume</th>
                    <th className="py-4 px-6">Prize Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-sm text-zinc-300">
                  {top21Leaders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500 font-light">
                        No leaders registered yet. Build your downline to qualify!
                      </td>
                    </tr>
                  ) : (
                    top21Leaders.map((leader, index) => {
                      const addrMasked = `${leader.walletAddress.substring(0, 6)}...${leader.walletAddress.substring(leader.walletAddress.length - 4)}`;
                      return (
                        <tr key={leader.walletAddress} className="hover:bg-zinc-950/20 transition-colors">
                          <td className="py-4 px-6 font-mono font-bold text-zinc-400">
                            #{index + 1}
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-semibold text-white">{leader.name}</span>
                            <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">{addrMasked}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                              leader.rank === 'Crown Leader' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                              leader.rank === 'Diamond Leader' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                              leader.rank === 'Gold Leader' ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' :
                              leader.rank === 'Silver Leader' ? 'text-zinc-300 bg-zinc-300/10 border-zinc-300/20' :
                              leader.rank === 'Bronze Leader' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                              'text-zinc-500 bg-zinc-900/50 border-zinc-800'
                            }`}>
                              {leader.rank}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono text-zinc-300">
                            {leader.teamVolume.toLocaleString()} ARES
                          </td>
                          <td className="py-4 px-6 font-semibold text-emerald-400">
                            {leader.prize}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Live events gallery */}
        <section className="mb-16">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 tracking-tight">
            <i className="fa-regular fa-image text-zinc-400 text-sm"></i> Official Live Events & Media
          </h3>
          {eventMedia.length === 0 ? (
            <div className="bg-[#09090b]/40 border border-zinc-900 rounded-2xl p-10 text-center text-zinc-500 font-light text-sm">
              No live event media published yet. Stay tuned for official coverage!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {eventMedia.map((media) => (
                <div key={media.id} className="bg-[#09090b]/60 border border-zinc-900 rounded-3xl p-5 hover:border-zinc-800 transition-all duration-300 overflow-hidden flex flex-col justify-between">
                  <div>
                    {media.type === 'VIDEO' ? (
                      <video 
                        src={media.url} 
                        controls 
                        className="w-full h-48 object-cover rounded-2xl bg-black border border-zinc-900/80 mb-4" 
                      />
                    ) : (
                      <img 
                        src={media.url} 
                        alt={media.title} 
                        className="w-full h-48 object-cover rounded-2xl border border-zinc-900/80 mb-4" 
                      />
                    )}
                    <h4 className="font-bold text-white text-base leading-tight px-1">{media.title}</h4>
                    {media.caption && (
                      <p className="text-zinc-400 text-xs mt-2 leading-relaxed px-1 font-light">{media.caption}</p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-900/40 text-[10px] text-zinc-500 font-mono flex justify-between px-1">
                    <span>EVENT COVERAGE</span>
                    <span>{new Date(media.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Blockchain Details Section */}
        <section className="mb-16">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 tracking-tight">
            <i className="fa-solid fa-server text-zinc-400 text-sm"></i> Aries L1 Blockchain Specifications
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl p-6 hover:border-zinc-800 transition-all duration-300">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Block Production Rate</span>
              <p className="text-base font-bold text-white mt-1">~1 Second Block Commit</p>
              <p className="text-zinc-500 text-xs mt-2 font-light">Tuned pacing parameter provides instant settlement times.</p>
            </div>
            <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl p-6 hover:border-zinc-800 transition-all duration-300">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Gas Pricing Engine</span>
              <p className="text-base font-bold text-white mt-1">EIP-1559 Dynamic Base Fee</p>
              <p className="text-zinc-500 text-xs mt-2 font-light">EIP-1559 base fee dynamically starts from 1 Gwei.</p>
            </div>
            <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl p-6 hover:border-zinc-800 transition-all duration-300">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Staking Minimums</span>
              <p className="text-base font-bold text-white mt-1">100 ARES Validation Entry</p>
              <p className="text-zinc-500 text-xs mt-2 font-light">Accessible entry requirements for retail yield participants.</p>
            </div>
            <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl p-6 hover:border-zinc-800 transition-all duration-300">
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Consensus Safeguard</span>
              <p className="text-base font-bold text-white mt-1">51,000 ARES Validator Delegation</p>
              <p className="text-zinc-500 text-xs mt-2 font-light">Guarantees decentralization and high network security thresholds.</p>
            </div>
          </div>
        </section>

        {/* Upcoming Releases Section */}
        <section>
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 tracking-tight">
            <i className="fa-solid fa-rocket text-zinc-400 text-sm"></i> Upcoming Ecosystem Releases
          </h3>
          <div className="space-y-4">
            <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-800 transition-all duration-300">
              <div className="p-3 bg-zinc-900 text-zinc-400 rounded-xl border border-zinc-800 text-sm">
                <i className="fa-solid fa-arrows-spin"></i>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Aries Swap DEX Integration</h4>
                <p className="text-zinc-500 text-xs mt-1 font-light">Automated Market Maker protocol for native token swaps and liquidity yield farming pools directly on the Aries EVM layer.</p>
              </div>
            </div>
            <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-800 transition-all duration-300">
              <div className="p-3 bg-zinc-900 text-zinc-400 rounded-xl border border-zinc-800 text-sm">
                <i className="fa-solid fa-piggy-bank"></i>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Decentralized Staking Hub v2</h4>
                <p className="text-zinc-500 text-xs mt-1 font-light">Dynamic compound rewards and self-delegation interfaces with hardware wallet support for validators.</p>
              </div>
            </div>
            <div className="bg-[#09090b]/60 border border-zinc-900/80 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-800 transition-all duration-300">
              <div className="p-3 bg-zinc-900 text-zinc-400 rounded-xl border border-zinc-800 text-sm">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Gasless Meta-Transaction Relayer SDK</h4>
                <p className="text-zinc-500 text-xs mt-1 font-light">Developer kit allowing dApps to sponsor transactions, enabling users to execute contracts with zero ARES balance using signed messages.</p>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
