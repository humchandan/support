'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PromotionsLanding() {
  const router = useRouter();
  
  const startYear = 2026;
  const currentYear = new Date().getFullYear();
  
  // Populate years: include current year, past years, and next 2 upcoming years for rich stacking scrolling
  const years = [];
  const maxYear = Math.max(currentYear + 2, startYear + 2);
  
  for (let y = startYear; y <= maxYear; y++) {
    let tag = 'ACTIVE CAMPAIGNS';
    let statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    let desc = '';
    let metricLabel = 'Staking Pool Boost';
    let metricVal = '10.5% APY';
    let isUpcoming = y > currentYear;

    if (y < currentYear) {
      tag = 'ARCHIVED';
      statusColor = 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
      desc = `Historical promotions, leaderboard logs, and validator event archives for the calendar year of ${y}.`;
      metricLabel = 'Total Rewards Paid';
      metricVal = '1.2M ARES';
    } else if (y === currentYear) {
      tag = 'ACTIVE CAMPAIGNS';
      statusColor = 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30';
      desc = `Explore currently active incentive programs, staking multipliers, and gas rebate challenges for ${y}.`;
      metricLabel = 'Active Reward Pool';
      metricVal = '5,000,000 ARES';
    } else {
      tag = 'COMING SOON';
      statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      desc = `Upcoming consensus rewards, cross-chain bridge launch pools, and developer grant campaigns scheduled for ${y}.`;
      metricLabel = 'Estimated Allocation';
      metricVal = '8.5M ARES';
    }

    if (y === 2026) {
      desc = 'Launch of the Aries L1 mainnet. Includes genesis staking bonuses, initial validator pools, and community incentive campaigns.';
      metricVal = 'Up to 18.2% APY';
    } else if (y === 2027) {
      desc = 'Aries Swap integration and bridge launch events. Yield farming booster campaigns and gasless transaction developer initiatives.';
      metricVal = '15,000,000 ARES';
    } else if (y === 2028) {
      desc = 'Institutional delegator pools, cross-chain contract integrations, and decentralization milestones with hardware signer rewards.';
      metricVal = '25,000,000 ARES';
    }

    years.push({
      year: y,
      tag,
      statusColor,
      desc,
      metricLabel,
      metricVal,
      isUpcoming
    });
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
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-[#fafafa] font-sans antialiased relative selection:bg-zinc-800 selection:text-white pb-32">
      {/* Background Dots Pattern & Ambient Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-zinc-800/10 blur-[120px] pointer-events-none" />

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
          <div className="text-lg font-bold tracking-tight text-white">
            Aries<span className="text-zinc-500">.</span>Promotions
          </div>
          <button 
            id="back-to-app-btn"
            onClick={() => router.push('/app')}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 border border-zinc-900 hover:border-zinc-800 bg-zinc-950/40 rounded-full"
          >
            <i className="fa-solid fa-arrow-left text-[10px]"></i> Back to App
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 pt-24">
        
        {/* Hero Section */}
        <section className="text-center mb-28">
          <span className="px-3 py-1 text-[10px] font-bold text-zinc-400 bg-zinc-900 rounded-full border border-zinc-800 uppercase tracking-wider">
            Consensus Directory
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-6 mb-4 tracking-tight leading-tight text-white">
            Ecosystem Campaigns & Promotions
          </h1>
          <p className="text-zinc-500 text-sm md:text-base font-light max-w-xl mx-auto leading-relaxed">
            Scroll down to review staking incentives, validator rewards, and community reward pools active across the Aries L1 network.
          </p>
          <div className="mt-8 flex justify-center">
            <div className="animate-bounce p-2.5 bg-zinc-950 border border-zinc-900 rounded-full text-zinc-500">
              <i className="fa-solid fa-arrow-down text-xs"></i>
            </div>
          </div>
        </section>

        {/* Sticky/Vanish Scroll Cards Container */}
        <section className="space-y-[12vh]">
          {years.map((y) => (
            <div 
              key={y.year}
              id={`year-card-${y.year}`}
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
                      <span className={`text-[10px] px-3 py-1 rounded-full font-bold border ${y.statusColor}`}>
                        {y.tag}
                      </span>
                      <h3 className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-white mt-4 group-hover:text-cyan-400 transition-colors">
                        {y.year}
                      </h3>
                    </div>
                    <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-2xl text-zinc-500 group-hover:text-cyan-400 group-hover:border-cyan-500/20 transition-all duration-300">
                      <i className="fa-regular fa-folder-open text-base"></i>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm md:text-base mt-6 font-light leading-relaxed">
                    {y.desc}
                  </p>
                </div>

                {/* Card Bottom / Metrics & Action */}
                <div className="mt-10 pt-6 border-t border-zinc-900/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      {y.metricLabel}
                    </span>
                    <p className="text-lg font-bold text-yellow-400 font-mono mt-0.5">
                      {y.metricVal}
                    </p>
                  </div>
                  
                  {y.isUpcoming ? (
                    <div className="text-zinc-500 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed">
                      Pool Unlocks Soon <i className="fa-solid fa-lock text-[10px]"></i>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push(`/promotions/${y.year}`)}
                      className="px-5 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-full transition-all transform hover:scale-[1.02] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(255,255,255,0.05)]"
                    >
                      Enter Campaigns <i className="fa-solid fa-arrow-right text-[10px] transition-transform group-hover:translate-x-0.5"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

      </main>
    </div>
  );
}
