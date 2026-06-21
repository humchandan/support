'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function JuneJulyPromotion({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const year = Number(unwrappedParams.year) || 2026;

  // Simulator States
  const [selfStake, setSelfStake] = useState(1000);
  const [directs, setDirects] = useState(3);
  const [avgStake, setAvgStake] = useState(1000);
  const [dupFactor, setDupFactor] = useState(2.0);

  // FAQ Accordion State
  const [activeFaq, setActiveFaq] = useState(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = new Date(`August 31, ${year} 23:59:59`).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days: d, hours: h, minutes: m, seconds: s });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [year]);

  // Dynamic MLM Calculations
  const personalYield = selfStake * 0.085; // 8.5% yield rate
  
  // Downline size: Directs + Level 2 + Level 3
  const level1Size = directs;
  const level2Size = Math.round(directs * dupFactor);
  const level3Size = Math.round(directs * dupFactor * dupFactor);
  const totalTeamSize = level1Size + level2Size + level3Size;
  const totalTeamVolume = totalTeamSize * avgStake;

  // Rank determination
  let rank = 'Default Partner';
  if (selfStake >= 10000 && directs >= 10 && totalTeamVolume >= 1000000) {
    rank = 'Crown Leader';
  } else if (selfStake >= 5000 && directs >= 8 && totalTeamVolume >= 250000) {
    rank = 'Diamond Leader';
  } else if (selfStake >= 2000 && directs >= 5 && totalTeamVolume >= 50000) {
    rank = 'Gold Leader';
  } else if (selfStake >= 1000 && directs >= 3 && totalTeamVolume >= 10000) {
    rank = 'Bronze Leader';
  }

  // Matching yield calculations (referrals matching commission)
  const l1YieldMatch = level1Size * avgStake * 0.085 * 0.05; // 5% matching
  const l2YieldMatch = level2Size * avgStake * 0.085 * 0.03; // 3% matching
  const l3YieldMatch = level3Size * avgStake * 0.085 * 0.02; // 2% matching
  const monthlyNetworkEarning = l1YieldMatch + l2YieldMatch + l3YieldMatch;
  
  const estimatedMonthlyEarnings = personalYield + monthlyNetworkEarning;

  // Staking Plans Data
  const stakingPlans = [
    { name: "Starter Plan", range: "100 - 999 ARES", rate: "8.5%", cap: "2.5x Max Yield", desc: "Access level 1 to 3 matching referral layers.", border: "border-zinc-900" },
    { name: "Leader Plan", range: "1,000 - 9,999 ARES", rate: "11.0%", cap: "2.5x Max Yield", desc: "Unlock Gold rank requirements and match up to level 6.", border: "border-zinc-800" },
    { name: "Whale Plan", range: "10,000+ ARES", rate: "13.5%", cap: "2.5x Max Yield", desc: "Ulimit legacy building, full 10 levels of commissions.", border: "border-zinc-700/80" }
  ];

  // Bill Pay Categories
  const billsData = [
    { title: "Electricity Bill Pay", icon: "fa-bolt", desc: "Stack 2,500 ARES or more to completely cover electricity costs using passive staking yield payouts." },
    { title: "Internet & Mobile", icon: "fa-wifi", desc: "Cover dynamic broadband, fiber connection, and 5G cellular bills with a small 500 ARES delegation." },
    { title: "Server & Hosting", icon: "fa-server", desc: "Run hosting node setups, virtual servers, or website domains for free using validator rewards." }
  ];

  // Prizes
  const prizes = [
    { name: "Fast charging Power Bank", target: "10,000 ARES", icon: "fa-battery-three-quarters", desc: "Achieved by reaching 10K team volume." },
    { name: "Aries Edition Smart Watch", target: "25,000 ARES", icon: "fa-clock", desc: "Achieved by reaching 25K team volume." },
    { name: "Apple iPad Air", target: "50,000 ARES", icon: "fa-tablet-screen-button", desc: "Achieved by reaching 50K team volume." },
    { name: "Premium Mobile Phone", target: "100,000 ARES", icon: "fa-mobile-screen-button", desc: "Achieved by reaching 100K team volume." },
    { name: "Premium Laptop Pro", target: "250,000 ARES", icon: "fa-laptop", desc: "Achieved by reaching 250K team volume." },
    { name: "Smart E-Scooter / Bike", target: "500,000 ARES", icon: "fa-motorcycle", desc: "Achieved by reaching 500K team volume." }
  ];

  // FAQs
  const faqs = [
    { q: "What is Aries L1?", a: "Aries is a high-performance EVM-compatible Layer 1 blockchain built using the Cosmos SDK, offering sub-second transaction commits, Dynamic gas pricing, and deflationary burn mechanisms." },
    { q: "How does the June & July launch promotion pool work?", a: "To celebrate the sovereign EVM launch, early participants staking in June and July receive higher yield multipliers and eligible reward payouts. Ranks achieved during these 2 months carry permanent delegation bonuses." },
    { q: "How do I qualify for the smart watch or iPad rewards?", a: "Rewards are unlocked based on accumulated downline staking volume (team volume) achieved during the promotion period. Once your team volume reaches the threshold, the prize claim button is enabled inside your partner dashboard." },
    { q: "When are staking rewards paid out?", a: "Staking rewards accrue in real-time (per block commit) and are deposited into your yield balance. You can claim or compound your accrued yield at any time directly through the dashboard interface." }
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-[#fafafa] font-sans antialiased relative selection:bg-zinc-800 selection:text-white pb-32">
      {/* Background Dots Pattern & Ambient Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-zinc-800/10 blur-[120px] pointer-events-none" />

      {/* Styled Inline elements */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        body {
          font-family: 'Outfit', sans-serif;
          background-color: #030303;
        }
        .shadcn-card {
          background-color: #09090b;
          border: 1px solid #18181b;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
          position: relative;
          overflow: hidden;
        }
        .shadcn-card-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(to right, #ffffff01 1px, transparent 1px), linear-gradient(to bottom, #ffffff01 1px, transparent 1px);
          background-size: 1rem 1rem;
          pointer-events: none;
        }
      `}</style>

      {/* Top Countdown Banner */}
      <div className="w-full bg-[#09090b] border-b border-zinc-900 py-3.5 text-center text-xs font-semibold text-zinc-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row justify-center items-center gap-3">
          <span className="flex items-center gap-1.5 text-zinc-200">
            <i className="fa-solid fa-fire animate-pulse text-xs text-yellow-500"></i> 2-MONTH LAUNCH PROMOTION ENDS IN:
          </span>
          <div className="flex items-center gap-1 font-mono text-white text-sm">
            <span className="px-2.5 py-1 bg-zinc-950 rounded border border-zinc-800">{timeLeft.days}d</span>
            <span className="px-2.5 py-1 bg-zinc-950 rounded border border-zinc-800">{timeLeft.hours}h</span>
            <span className="px-2.5 py-1 bg-zinc-950 rounded border border-zinc-800">{timeLeft.minutes}m</span>
            <span className="px-2.5 py-1 bg-zinc-950 rounded border border-zinc-800 text-yellow-500">{timeLeft.seconds}s</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="w-full border-b border-zinc-900 bg-[#030303]/80 backdrop-blur-md sticky top-0 z-50 py-5">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <Link href="/promotions" className="text-lg font-bold tracking-tight text-white hover:text-zinc-400 transition-colors">
            Aries<span className="text-zinc-500">.</span>Promotions
          </Link>
          <Link 
            href={`/promotions/${year}`}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 border border-zinc-900 hover:border-zinc-800 bg-zinc-950/40 rounded-full"
          >
            <i className="fa-solid fa-arrow-left text-[10px]"></i> Back to {year}
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 pt-20">
        <section className="text-center max-w-2xl mx-auto mb-24">
          <span className="px-3 py-1 text-[10px] font-bold text-zinc-400 bg-zinc-900 rounded-full border border-zinc-800 uppercase tracking-wider">
            June - July Double Event
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-6 mb-4 tracking-tight leading-tight text-white uppercase">
            Sovereign EVM Launch Event
          </h1>
          <p className="text-zinc-500 text-sm md:text-base font-light max-w-xl mx-auto leading-relaxed">
            Welcome to the genesis expansion of the Aries L1 blockchain. Stake, delegate to validators, build downline networks, and claim electronic rewards.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button 
              onClick={() => {
                const element = document.getElementById('plans');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-2.5 bg-white text-black font-bold text-xs rounded-full hover:bg-zinc-200 transition-all transform hover:scale-[1.02]"
            >
              View Staking Plans
            </button>
            <button 
              onClick={() => {
                const element = document.getElementById('simulator');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-2.5 bg-zinc-900 border border-zinc-850 text-white font-bold text-xs rounded-full hover:bg-zinc-800 transition-all transform hover:scale-[1.02]"
            >
              Yield Calculator
            </button>
          </div>
        </section>

        {/* Blockchain Tech Specifications Section */}
        <section className="mb-24">
          <h2 className="text-lg font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
            Cutting-Edge Blockchain Specs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="shadcn-card rounded-2xl p-8 hover:border-zinc-800 transition-all group">
              <div className="shadcn-card-grid" />
              <div className="p-3.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded-xl w-fit mb-6 text-base group-hover:text-cyan-400 group-hover:border-cyan-500/20 transition-all duration-300">
                <i className="fa-solid fa-rocket"></i>
              </div>
              <h3 className="text-base font-bold text-white mb-2">1-Second Block Finality</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">Tuned consensus parameters commit blocks under 1 second, providing instant merchant settlement and low latency meta Relays.</p>
            </div>
            <div className="shadcn-card rounded-2xl p-8 hover:border-zinc-800 transition-all group">
              <div className="shadcn-card-grid" />
              <div className="p-3.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded-xl w-fit mb-6 text-base group-hover:text-yellow-500 group-hover:border-yellow-500/20 transition-all duration-300">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="text-base font-bold text-white mb-2">High-Throughput Security</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">Secured by 51,000 ARES delegated validator nodes, generating maximum security thresholds and robust network resilience.</p>
            </div>
            <div className="shadcn-card rounded-2xl p-8 hover:border-zinc-800 transition-all group">
              <div className="shadcn-card-grid" />
              <div className="p-3.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded-xl w-fit mb-6 text-base group-hover:text-amber-500 group-hover:border-amber-500/20 transition-all duration-300">
                <i className="fa-solid fa-fire-flame-curved"></i>
              </div>
              <h3 className="text-base font-bold text-white mb-2">EIP-1559 Base Fee Burn</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">Dynamic gas base fees (starting from 1 Gwei) are burned permanently, generating dynamic token utility and supply reduction under high-load stress.</p>
            </div>
          </div>
        </section>

        {/* Staking Standard Plans Section */}
        <section id="plans" className="mb-24">
          <h2 className="text-lg font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
            Aries ChainSupport Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stakingPlans.map((plan) => (
              <div key={plan.name} className={`shadcn-card rounded-2xl p-8 flex flex-col justify-between min-h-[300px] border ${plan.border} group`}>
                <div className="shadcn-card-grid" />
                <div>
                  <h3 className="text-base font-bold text-white mb-1.5">{plan.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold">{plan.range}</span>
                  <p className="text-zinc-500 text-xs mt-5 leading-relaxed">{plan.desc}</p>
                </div>
                <div className="mt-8 pt-5 border-t border-zinc-900 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-medium">Accrual Rate</span>
                    <span className="text-xl font-bold text-yellow-400 font-mono">{plan.rate} / mo</span>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full border border-zinc-800 text-zinc-400 font-bold bg-zinc-950">{plan.cap}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bill Kill Savings Section */}
        <section className="mb-24">
          <h2 className="text-lg font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
            Bill Clearance Coverages
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {billsData.map((bill) => (
              <div key={bill.title} className="shadcn-card rounded-2xl p-8 hover:border-zinc-800 transition-colors group">
                <div className="shadcn-card-grid" />
                <div className="p-3.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded-xl w-fit mb-6 text-base group-hover:text-emerald-400 group-hover:border-emerald-500/20 transition-all duration-300">
                  <i className={`fa-solid ${bill.icon}`}></i>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{bill.title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{bill.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* MLM referral matrix table */}
        <section className="mb-24">
          <h2 className="text-lg font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
            MLM Referral Match Levels
          </h2>
          <p className="text-center text-zinc-500 max-w-2xl mx-auto mb-10 leading-relaxed text-xs md:text-sm">
            Earn matching commissions on network staking yields when downline members claim rewards. Build teams to unlock higher ranks and unlock levels up to 10 deep.
          </p>
          <div className="shadcn-card rounded-2xl overflow-hidden border border-zinc-900 shadow-2xl">
            <div className="shadcn-card-grid" />
            <div className="overflow-x-auto relative z-10">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 font-semibold">
                    <th className="p-4 font-bold">Level</th>
                    <th className="p-4 font-bold">Match Commission %</th>
                    <th className="p-4 font-bold">Required Rank</th>
                    <th className="p-4 font-bold">Level Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  <tr className="hover:bg-zinc-900/35 transition-colors">
                    <td className="p-4 font-semibold text-white">Level 1</td>
                    <td className="p-4 text-cyan-400 font-bold font-mono">5.0%</td>
                    <td className="p-4">Default Partner</td>
                    <td className="p-4 text-zinc-500">Direct Referrals</td>
                  </tr>
                  <tr className="hover:bg-zinc-900/35 transition-colors">
                    <td className="p-4 font-semibold text-white">Level 2</td>
                    <td className="p-4 text-cyan-400 font-bold font-mono">3.0%</td>
                    <td className="p-4">Default Partner</td>
                    <td className="p-4 text-zinc-500">Tier 2 Network</td>
                  </tr>
                  <tr className="hover:bg-zinc-900/35 transition-colors">
                    <td className="p-4 font-semibold text-white">Level 3</td>
                    <td className="p-4 text-cyan-400 font-bold font-mono">2.0%</td>
                    <td className="p-4">Default Partner</td>
                    <td className="p-4 text-zinc-500">Tier 3 Network</td>
                  </tr>
                  <tr className="hover:bg-zinc-900/35 transition-colors">
                    <td className="p-4 font-semibold text-white">Level 4 - 5</td>
                    <td className="p-4 text-yellow-400 font-bold font-mono">1.0%</td>
                    <td className="p-4 text-yellow-500 font-medium">Bronze Leader</td>
                    <td className="p-4 text-zinc-500">Tier 4-5 Network</td>
                  </tr>
                  <tr className="hover:bg-zinc-900/35 transition-colors">
                    <td className="p-4 font-semibold text-white">Level 6</td>
                    <td className="p-4 text-yellow-400 font-bold font-mono">0.5%</td>
                    <td className="p-4 text-yellow-500 font-medium">Gold Leader</td>
                    <td className="p-4 text-zinc-500">Tier 6 Network</td>
                  </tr>
                  <tr className="hover:bg-zinc-900/35 transition-colors">
                    <td className="p-4 font-semibold text-white">Level 7 - 8</td>
                    <td className="p-4 text-orange-400 font-bold font-mono">0.25%</td>
                    <td className="p-4 text-orange-500 font-medium">Diamond Leader</td>
                    <td className="p-4 text-zinc-500">Tier 7-8 Network</td>
                  </tr>
                  <tr className="hover:bg-zinc-900/35 transition-colors">
                    <td className="p-4 font-semibold text-white">Level 9 - 10</td>
                    <td className="p-4 text-orange-400 font-bold font-mono">0.10%</td>
                    <td className="p-4 text-orange-500 font-medium">Crown Leader</td>
                    <td className="p-4 text-zinc-500">Tier 9-10 Network</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Live Electronics Rewards Section */}
        <section className="mb-24">
          <h2 className="text-lg font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
            Hardware Consolation Prizes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {prizes.map((prize) => (
              <div key={prize.name} className="shadcn-card rounded-2xl p-6 flex items-start gap-4 hover:border-zinc-800 transition-all group">
                <div className="shadcn-card-grid" />
                <div className="p-3 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded-xl text-base group-hover:text-yellow-500 group-hover:border-yellow-500/20 transition-all duration-300">
                  <i className={`fa-solid ${prize.icon}`}></i>
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-white text-sm">{prize.name}</h3>
                  <span className="text-[10px] font-bold text-yellow-400 font-mono mt-0.5 block">Target: {prize.target}</span>
                  <p className="text-zinc-500 text-[10px] mt-2 leading-relaxed font-light">{prize.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Earnings Calculator Simulator Section */}
        <section id="simulator" className="mb-24">
          <h2 className="text-lg font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
            Partner Revenue Estimator
          </h2>
          
          <div className="shadcn-card rounded-2xl p-8 md:p-10 shadow-2xl border border-zinc-900">
            <div className="shadcn-card-grid" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
              
              {/* Slider Inputs */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-zinc-400">Your Self Staking (ARES)</span>
                    <span className="text-sm font-bold text-cyan-400 font-mono">{selfStake.toLocaleString()} ARES</span>
                  </div>
                  <input 
                    type="range" 
                    min="100" 
                    max="50000" 
                    step="100" 
                    value={selfStake} 
                    onChange={(e) => setSelfStake(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-zinc-400">Direct Referrals (Level 1)</span>
                    <span className="text-sm font-bold text-cyan-400 font-mono">{directs} members</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="15" 
                    step="1" 
                    value={directs} 
                    onChange={(e) => setDirects(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-zinc-400">Average Staking Per Member</span>
                    <span className="text-sm font-bold text-cyan-400 font-mono">{avgStake.toLocaleString()} ARES</span>
                  </div>
                  <input 
                    type="range" 
                    min="100" 
                    max="10000" 
                    step="100" 
                    value={avgStake} 
                    onChange={(e) => setAvgStake(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-zinc-400">Viral Duplication Factor</span>
                    <span className="text-sm font-bold text-cyan-400 font-mono">{dupFactor.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="4" 
                    step="0.5" 
                    value={dupFactor} 
                    onChange={(e) => setDupFactor(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>

              {/* Simulation Result Box */}
              <div className="bg-[#030303] border border-zinc-850 rounded-xl p-6">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Projected Yields (30 Days)</h3>
                
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-zinc-900/60">
                    <span className="text-zinc-400">Personal Staking Yield (8.5%):</span>
                    <span className="font-bold text-white font-mono">{personalYield.toFixed(2)} ARES</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-900/60">
                    <span className="text-zinc-400">Unlocked Rank (MLM Rules):</span>
                    <span className="font-bold text-cyan-400">{rank}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-900/60">
                    <span className="text-zinc-400">Total Downline Team Size:</span>
                    <span className="font-bold text-white font-mono">{totalTeamSize} members</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-900/60">
                    <span className="text-zinc-400">Total Downline Team Volume:</span>
                    <span className="font-bold text-white font-mono">{totalTeamVolume.toLocaleString()} ARES</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-900/60">
                    <span className="text-zinc-400">Monthly Network Match Yield:</span>
                    <span className="font-bold text-white font-mono">{monthlyNetworkEarning.toFixed(2)} ARES</span>
                  </div>
                  
                  <div className="flex justify-between pt-5 mt-3 border-t border-zinc-800 items-center">
                    <span className="text-sm font-semibold text-white">Estimated Monthly Total:</span>
                    <span className="text-2xl font-black text-yellow-400 font-mono tracking-tight">{estimatedMonthlyEarnings.toFixed(2)} ARES</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* FAQs Section */}
        <section className="mb-24 max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-3.5">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="shadcn-card rounded-xl overflow-hidden border border-zinc-900">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full text-left p-5 font-bold text-sm text-white flex justify-between items-center gap-4 hover:bg-zinc-950/40 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <i className={`fa-solid fa-chevron-down text-[10px] text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                  </button>
                  {isOpen && (
                    <div className="p-5 pt-0 text-zinc-400 text-xs leading-relaxed border-t border-zinc-900/50 bg-zinc-950/20">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
