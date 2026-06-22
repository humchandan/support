'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';
import WealthTab from './WealthTab';
import PaymentsTab from './PaymentsTab';
import ProfileTab from './ProfileTab';
import NetworksTab from './NetworksTab';

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
      <div className="px-6 py-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
            <img src="/logo.png" alt="Aries Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight leading-tight">
              Aries<span className="text-cyan-400">.</span>Portal
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">ChainID 232425</div>
          </div>
        </div>
      </div>

      {/* Nav section */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          Main Menu
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); onClose?.(); }}
              className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-white text-black shadow-md shadow-white/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold leading-tight ${activeTab === item.id ? 'text-black' : ''}`}>
                  {item.label}
                </div>
                <div className={`text-[10px] leading-tight mt-0.5 ${activeTab === item.id ? 'text-zinc-500' : 'text-zinc-600 group-hover:text-zinc-500'}`}>
                  {item.desc}
                </div>
              </div>
              {activeTab === item.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-black/40 flex-shrink-0" />
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
          <button
            onClick={() => { router.push('/promotions'); onClose?.(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all duration-200"
          >
            <span className="text-base">🎁</span>
            <div>
              <div className="text-sm font-semibold leading-tight">Promotions Hub</div>
              <div className="text-[10px] text-zinc-600 leading-tight mt-0.5">Offers & leaderboards</div>
            </div>
          </button>
        </div>
      </div>

      {/* User section */}
      <div className="px-3 py-4 border-t border-zinc-800/60 space-y-3">
        {/* Network status pill */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse flex-shrink-0" />
            <span className="text-xs text-zinc-400 font-medium">Node Live</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-600">100% uptime</span>
        </div>

        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/40 rounded-xl border border-zinc-800/40">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">👤</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate leading-tight">
              {userProfile?.name || 'Ares Member'}
            </div>
            <div className="text-[10px] text-zinc-500 truncate font-mono leading-tight mt-0.5">
              {formattedAddress}
            </div>
          </div>
        </div>

        <button
          onClick={disconnectWallet}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900/60 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 text-xs font-semibold rounded-xl border border-zinc-800/40 hover:border-red-900/40 transition-all duration-200"
        >
          <span className="text-xs">⏻</span> Disconnect Wallet
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
      <div className="flex-1 flex flex-col min-w-0 relative z-10">

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
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8 xl:px-10 xl:py-10 max-w-screen-xl w-full mx-auto">

          {/* ── TOP STATS BAR ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">

            {/* Wallet Balance */}
            <div className="sm:col-span-2 group relative bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 overflow-hidden hover:border-zinc-700/60 transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] rounded-full blur-2xl -translate-y-8 translate-x-8 pointer-events-none" />
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Connected Wallet Balance</div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl xl:text-4xl font-black text-white tracking-tight">
                  {ethBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </span>
                <span className="text-sm font-bold text-zinc-500 font-mono">ARES</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 bg-zinc-950/60 px-2.5 py-1.5 rounded-lg border border-zinc-800/40 hover:text-zinc-300 hover:border-zinc-700/40 transition-all cursor-pointer select-all max-w-full overflow-hidden">
                <span className="truncate">{userAddress || '—'}</span>
              </div>
            </div>

            {/* Network Node */}
            <div className="group relative bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 overflow-hidden hover:border-zinc-700/60 transition-all duration-300">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Network Node</div>
              <div className="text-base font-bold text-white mb-4 leading-tight">Aries Chain Support</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse flex-shrink-0" />
                <span className="text-xs text-zinc-400 font-medium">Node Sync Live</span>
              </div>
              <div className="mt-2 text-[10px] font-mono text-zinc-600">ChainID 232425 • 100% uptime</div>
            </div>

            {/* Accrued Yield */}
            <div className="group relative bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 overflow-hidden hover:border-zinc-700/60 transition-all duration-300">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Your Rank</div>
              <div className="text-xl font-black text-white mb-1">{userProfile?.rank || 'Default'}</div>
              <div className="text-xs text-zinc-500">
                {userProfile?.selfInvestment
                  ? `${Number(userProfile.selfInvestment).toLocaleString()} ARES staked`
                  : 'No plans active'}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: '35%' }} />
                </div>
                <span className="text-[10px] text-zinc-600 font-mono">Lv 1</span>
              </div>
            </div>

          </div>

          {/* ── PAGE HEADER ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>{activeNavItem?.icon}</span>
                {activeNavItem?.label}
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">{activeNavItem?.desc}</p>
            </div>
            {/* Mobile tab pills */}
            <div className="flex lg:hidden gap-1 bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-1">
              {NAV_ITEMS.slice(0, 3).map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === item.id
                      ? 'bg-white text-black'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {item.icon}
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
