'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';
import WealthTab from './WealthTab';
import PaymentsTab from './PaymentsTab';
import ProfileTab from './ProfileTab';
import NetworksTab from './NetworksTab';
import { motion } from 'framer-motion';
import { BackgroundGradient } from './ui/background-gradient';

const NAV_ITEMS = [
  { id: 'wealth', label: 'Wealth & Staking', icon: '📈', desc: 'Plans & yield' },
  { id: 'payments', label: 'Transfers', icon: '💸', desc: 'Payments & ledger' },
  { id: 'networks', label: 'Network', icon: '🌐', desc: 'Referrals & MLM' },
  { id: 'profile', label: 'Profile', icon: '👤', desc: 'Settings & KYC' },
];

export default function DashboardView() {
  const { userAddress, provider, userProfile, disconnectWallet } = useWeb3();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('wealth');
  const [ethBalance, setEthBalance] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!provider || !userAddress) return;
    const fetchBalance = async () => {
      try {
        const bal = await provider.getBalance(userAddress);
        setEthBalance(parseFloat(ethers.formatEther(bal)));
      } catch (err) {
        console.error('Failed to query wallet balance:', err);
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [provider, userAddress]);

  const formattedAddress = userAddress
    ? `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`
    : 'Not connected';

  const activeNavItem = NAV_ITEMS.find(n => n.id === activeTab);

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <img src="/logo.png" alt="Aries Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
          </div>
          <div>
            <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight leading-tight flex items-center">
              Aries<span className="text-cyan-400 text-xl font-bold leading-none -mt-1 relative"><span className="absolute -inset-1 bg-cyan-400/50 blur-sm rounded-full"></span>.</span>Portal
            </div>
            <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5">ChainID 232425</div>
          </div>
        </div>
      </div>

      {/* Nav section */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          Main Menu
        </div>
        <nav className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); onClose?.(); }}
              className={`relative group flex items-center gap-3 w-full px-3 py-3 rounded-2xl text-left transition-all duration-300 ${
                activeTab === item.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTabSidebar"
                  className="absolute inset-0 bg-white/[0.08] border border-white/10 rounded-2xl shadow-[inset_0_0_12px_rgba(255,255,255,0.03)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className={`relative z-10 text-lg transition-transform duration-300 ${activeTab === item.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'group-hover:scale-110 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                {item.icon}
              </span>
              <div className="relative z-10 flex-1 min-w-0">
                <div className={`text-sm font-bold leading-tight tracking-wide transition-colors ${activeTab === item.id ? 'text-white drop-shadow-sm' : ''}`}>
                  {item.label}
                </div>
                <div className={`text-[10px] leading-tight mt-0.5 transition-colors ${activeTab === item.id ? 'text-zinc-300' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                  {item.desc}
                </div>
              </div>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="relative z-10 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] flex-shrink-0" 
                />
              )}
            </button>
          ))}
        </nav>

        <div className="my-5 h-px bg-zinc-800/60" />

        <div className="mb-2 px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          Quick Links
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => { router.push('/portal'); onClose?.(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all duration-200"
          >
            <span className="text-base">🛒</span>
            <div>
              <div className="text-sm font-semibold leading-tight">Utility Portal</div>
              <div className="text-[10px] text-zinc-600 leading-tight mt-0.5">Recharge & services</div>
            </div>
          </button>
        </div>
      </div>

      {/* User section */}
      <div className="px-4 py-5 border-t border-white/5 space-y-4 bg-gradient-to-t from-white/[0.02] to-transparent">
        {/* Network status pill */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-black/40 rounded-xl border border-white/5 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-zinc-300 font-semibold tracking-wide">Node Live</span>
          </div>
          <span className="text-[10px] font-bold tracking-widest text-emerald-500/70 uppercase">100% Sync</span>
        </div>

        {/* User card with subtle gradient background */}
        <div className="relative group p-[1px] rounded-2xl bg-gradient-to-b from-white/10 to-transparent">
          <div className="flex items-center gap-3 px-3 py-3 bg-black/60 backdrop-blur-md rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center flex-shrink-0 shadow-lg relative z-10">
              <span className="text-base drop-shadow-md">👤</span>
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <div className="text-sm font-black text-white truncate tracking-tight">
                {userProfile?.name || 'Ares Member'}
              </div>
              <div className="text-[10px] text-zinc-400 truncate font-mono tracking-widest mt-0.5">
                {formattedAddress}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={disconnectWallet}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/5 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 text-xs font-bold uppercase tracking-widest rounded-xl border border-red-500/10 hover:border-red-500/30 transition-all duration-300"
        >
          <span className="text-xs">⏻</span> Disconnect
        </button>
      </div>
    </div>
  );

  return (
    <div id="dashboard-view" className="flex min-h-screen bg-[#030303] text-[#fafafa] font-sans antialiased">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(120,119,198,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#18181b_1px,transparent_1px)] [background-size:28px_28px] opacity-40" />
      </div>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-[#0a0a0c]/90 backdrop-blur-xl border-r border-zinc-800/50 z-30 shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* ── MOBILE DRAWER ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-[#0a0a0c] border-r border-zinc-800/50 h-full shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all text-xs z-10"
            >
              ✕
            </button>
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 overflow-x-hidden max-w-[100vw]">

        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between px-5 py-4 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
              <img src="/logo.png" alt="Aries Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-bold text-white">
              Aries<span className="text-cyan-400">.</span>Portal
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 hover:text-white text-xs font-medium transition-all"
          >
            <span>{sidebarOpen ? '✕' : '☰'}</span>
            <span>Menu</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10 max-w-screen-xl w-full mx-auto min-w-0">

          {/* ── TOP STATS BAR ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

            {/* Wallet Balance */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Connected Balance</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                    {ethBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                  <span className="text-xs font-bold text-zinc-500 font-mono">ARES</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 bg-black/40 px-2.5 py-1 rounded border border-white/5 mt-3 shadow-inner">
                  <span className="truncate">{userAddress || '—'}</span>
                </div>
              </div>
            </div>

            {/* Network Node */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Network Node</div>
                <div className="text-lg font-bold text-white leading-tight">Aries Chain Support</div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs text-zinc-300 font-semibold tracking-wide">Node Sync Live</span>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-zinc-600 tracking-widest uppercase">ChainID 232425 • 100% uptime</div>
                </div>
              </div>
            </div>

            {/* Accrued Yield */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Your Rank</div>
                <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  {userProfile?.rank || 'Default'}
                </div>
                <div className="mt-2">
                  <div className="text-xs text-zinc-400 font-semibold">
                    {userProfile?.selfInvestment
                      ? `${Number(userProfile.selfInvestment).toLocaleString()} ARES staked`
                      : 'No plans active'}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full w-[35%] relative">
                        <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono font-bold">Lv 1</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── PAGE HEADER ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>{activeNavItem?.icon}</span>
                {activeNavItem?.label}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{activeNavItem?.desc}</p>
            </div>
            {/* Mobile tab pills */}
            <div className="flex lg:hidden gap-1 bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-1 self-start sm:self-auto overflow-x-auto">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                    activeTab === item.id
                      ? 'bg-white text-black'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB CONTENT ── */}
          <div>
            {activeTab === 'wealth' && <WealthTab />}
            {activeTab === 'payments' && <PaymentsTab />}
            {activeTab === 'networks' && <NetworksTab />}
            {activeTab === 'profile' && <ProfileTab />}
          </div>

        </main>
      </div>
    </div>
  );
}
