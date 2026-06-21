'use client';

import React, { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

const MONTHS_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTHS_INFO = {
  "January": { desc: "New Year Staking Booster. Double yield rewards on all newly created staking validator delegations.", pool: "1,500,000 ARES", badge: "STAKING APY" },
  "February": { desc: "Validator Gas rebate campaign. Refund up to 30% of gas fees consumed during smart contract execution.", pool: "800,000 ARES", badge: "GAS REBATES" },
  "March": { desc: "Ecosystem Builder Grants. Developer pool launch for builders deploying innovative smart contracts.", pool: "2,000,000 ARES", badge: "DEV GRANTS" },
  "April": { desc: "NFT Minting booster. Sponsoring up to 5 free NFT mints for active delegators on the network.", pool: "1,200,000 ARES", badge: "NFT REWARDS" },
  "May": { desc: "Cross-chain bridge launch rewards. Yield multipliers for bridging assets onto Aries L1 from other EVM chains.", pool: "3,000,000 ARES", badge: "BRIDGE POOL" },
  "June": { desc: "Genesis Staking launch campaign. Exclusive higher rate multipliers for early validator pool participants.", pool: "5,000,000 ARES", badge: "GENESIS BOOSTER" },
  "July": { desc: "Sovereign EVM Launch Event. Global leaderboard rewards for top trading volume and staking achievements.", pool: "8,000,000 ARES", badge: "LAUNCH EVENT" },
  "August": { desc: "Community delegation booster. Bonus allocation pool for community nodes who reach 50+ delegators.", pool: "1,800,000 ARES", badge: "DELEGATOR BONUS" },
  "September": { desc: "Aries Swap Liquidity Pool launch. Multipliers for farming pool tokens on our native decentralized exchange.", pool: "4,000,000 ARES", badge: "LIQUIDITY MINING" },
  "October": { desc: "Decentralized Staking Hub v2 rollout pool. Rewards for transitioning validator delegation to compound pools.", pool: "2,500,000 ARES", badge: "HUB V2 REWARDS" },
  "November": { desc: "Gasless meta-transaction relayer campaign. Yield incentives for developers running active meta-relayer scripts.", pool: "1,900,000 ARES", badge: "RELAYER REWARDS" },
  "December": { desc: "Annual consensus summary bonus. Loyalty payouts for validators with 99.99%+ uptime throughout the year.", pool: "3,500,000 ARES", badge: "UPTIME REWARDS" }
};

export default function YearLanding({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const year = Number(unwrappedParams.year) || 2026;
  
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentCalendarMonth = now.getMonth(); // 0 = Jan, 11 = Dec

  // Allow navigation for current calendar year, past years, and next 2 upcoming years
  const isInvalidYear = year < 2026 || year > (currentCalendarYear + 2);
  
  const startMonthIndex = year === 2026 ? 5 : 0; // June is index 5
  const endMonthIndex = 11; // Always generate all months of the year
  
  const activeMonths = [];
  if (!isInvalidYear) {
    let m = startMonthIndex;
    while (m <= endMonthIndex) {
      if (year === 2026 && m === 5) {
        activeMonths.push({
          name: "June & July",
          route: "June-July",
          desc: "2-Month Sovereign EVM Launch Promotion. The ultimate 10-level referral matrix booster, APY yield events, and validator milestone campaigns.",
          pool: "13,000,000 ARES",
          badge: "LAUNCH DOUBLE POOL",
          isLocked: false
        });
        m = 7; // skip June and July, go to August
        continue;
      }
      
      const name = MONTHS_LIST[m];
      const isLocked = true; // All other months default to locked/achievements page
      
      activeMonths.push({
        name,
        route: name,
        desc: "Stay tuned for upcoming promotions. Click to view ecosystem achievements, live validator statistics, and leaderboards.",
        pool: "TBD",
        badge: "STAY TUNED",
        isLocked
      });
      m++;
    }
  }

  // Fallback for browsers that do not support CSS scroll-driven animations (e.g. Firefox)
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.CSS?.supports('(animation-timeline: view()) and (animation-range: entry)')) {
      const cards = document.querySelectorAll('.sticky-card');
      const handleScroll = () => {
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const cardHeight = rect.height;
          const triggerPoint = 120; // matches top: 120px
          if (rect.top <= triggerPoint) {
            // Calculate scale down & fade out progress as card scrolls up past the trigger point
            const progress = Math.min(1, Math.max(0, (triggerPoint - rect.top) / (cardHeight * 0.85)));
            card.style.opacity = (1 - progress).toString();
            card.style.transform = `scale(${1 - progress * 0.12}) translateY(${-progress * 60}px)`;
            card.style.filter = `blur(${progress * 8}px)`;
          } else {
            card.style.opacity = '1';
            card.style.transform = 'scale(1) translateY(0px)';
            card.style.filter = 'none';
          }
        });
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [isInvalidYear]);

  return (
    <div className="min-h-screen bg-[#030303] text-[#fafafa] font-sans antialiased relative selection:bg-zinc-800 selection:text-white pb-32">
      {/* Background Dots Pattern & Ambient Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-zinc-800/10 blur-[120px] pointer-events-none" />

      {/* Custom Inline CSS for Scroll-Driven Stacking Animations */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        body {
          font-family: 'Outfit', sans-serif;
          background-color: #030303;
        }
        
        .sticky-card {
          position: sticky;
          top: 120px;
          transform-origin: center top;
          transition: transform 0.1s ease-out, opacity 0.1s ease-out, filter 0.1s ease-out;
        }

        /* Native CSS Scroll-driven Animations for browsers that support it */
        @supports (animation-timeline: view()) {
          @keyframes vanish {
            to {
              transform: scale(0.88) translateY(-60px);
              opacity: 0;
              filter: blur(8px);
            }
          }
          .sticky-card {
            animation: vanish linear forwards;
            animation-timeline: view();
            animation-range: exit 0% exit 100%;
            /* Disable JS transition when CSS timeline is handling it to prevent stutter */
            transition: none !important;
          }
        }
      `}</style>

      {/* Navigation Header */}
      <header className="w-full border-b border-zinc-900 bg-[#030303]/80 backdrop-blur-md sticky top-0 z-50 py-5">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <div 
            id="promotions-brand-header"
            role="button"
            tabIndex={0}
            onClick={() => router.push('/promotions')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                router.push('/promotions');
              }
            }}
            className="text-lg font-bold tracking-tight text-white cursor-pointer hover:text-zinc-400 transition-colors focus:outline-none"
          >
            Aries<span className="text-zinc-500">.</span>Promotions
          </div>
          <button 
            id="back-to-all-years-btn"
            onClick={() => router.push('/promotions')}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 border border-zinc-900 hover:border-zinc-800 bg-zinc-950/40 rounded-full"
          >
            <i className="fa-solid fa-arrow-left text-[10px]"></i> All Years
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 pt-24">
        
        {isInvalidYear ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-red-400">Invalid Year Requested</h2>
            <p className="text-zinc-500 mt-2 text-sm">Promotions only started in June 2026. Please check a valid year.</p>
            <button 
              id="back-to-promotions-btn"
              onClick={() => router.push('/promotions')}
              className="mt-6 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full border border-zinc-800 transition-colors text-xs font-semibold"
            >
              Back to Promotions
            </button>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <section className="text-center mb-28">
              <span className="px-3 py-1 text-[10px] font-bold text-zinc-400 bg-zinc-900 rounded-full border border-zinc-800 uppercase tracking-wider">
                Campaign Calendar
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold mt-6 mb-4 tracking-tight leading-tight text-white uppercase">
                Campaigns in {year}
              </h1>
              <p className="text-zinc-500 text-sm md:text-base font-light max-w-xl mx-auto leading-relaxed">
                Scroll through dynamic monthly incentives, leaderboards, and rewards available for the year of {year}.
              </p>
              <div className="mt-8 flex justify-center">
                <div className="animate-bounce p-2.5 bg-zinc-950 border border-zinc-900 rounded-full text-zinc-500">
                  <i className="fa-solid fa-arrow-down text-xs"></i>
                </div>
              </div>
            </section>

            {/* Sticky/Vanish Scroll Cards Container */}
            <section className="space-y-[12vh]">
              {activeMonths.map((m) => (
                <div 
                  key={m.name}
                  id={`month-card-${m.name.toLowerCase()}`}
                  className="sticky-card w-full group rounded-3xl"
                >
                  <div className="bg-[#09090b]/85 border border-zinc-900 group-hover:border-zinc-800 rounded-3xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 flex flex-col justify-between min-h-[320px] relative overflow-hidden">
                    {/* Background grid overlay in card */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />
                    
                    {/* Subtle Hover glow effect */}
                    <div className="absolute -inset-px bg-gradient-to-r from-zinc-800/10 to-zinc-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl -z-10" />

                    {/* Card Top */}
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`text-xs px-3 py-1 rounded-full font-bold border ${m.isLocked ? 'text-zinc-500 bg-zinc-900/50 border-zinc-800' : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'}`}>
                            {m.badge}
                          </span>
                          <h3 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-4 group-hover:text-zinc-400 transition-colors uppercase">
                            {m.name}
                          </h3>
                        </div>
                        <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-2xl text-zinc-500 group-hover:border-zinc-800 transition-all duration-300">
                          <i className={`fa-solid ${m.isLocked ? 'fa-lock' : 'fa-calendar-days'} text-base`}></i>
                        </div>
                      </div>
                      <p className="text-zinc-400 text-sm md:text-base mt-6 font-light leading-relaxed">
                        {m.desc}
                      </p>
                    </div>

                    {/* Card Bottom / Metrics & Action */}
                    <div className="mt-10 pt-6 border-t border-zinc-900/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          ESTIMATED VALUE POOL
                        </span>
                        <p className={`text-lg font-bold font-mono mt-0.5 ${m.isLocked ? 'text-zinc-500' : 'text-cyan-400'}`}>
                          {m.pool}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => router.push(`/promotions/${year}/${m.route}`)}
                        className={`px-5 py-2.5 font-bold text-xs rounded-full transition-all transform hover:scale-[1.02] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(255,255,255,0.05)] ${
                          m.isLocked
                            ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                            : 'bg-white hover:bg-zinc-200 text-black'
                        }`}
                      >
                        {m.isLocked ? (
                          <>
                            Stay Tuned <i className="fa-solid fa-lock text-[10px]"></i>
                          </>
                        ) : (
                          <>
                            Explore Rewards <i className="fa-solid fa-arrow-right text-[10px] transition-transform group-hover:translate-x-0.5"></i>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

      </main>
    </div>
  );
}
