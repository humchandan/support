'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';

import { BentoGrid, BentoGridItem } from './ui/bento-grid';
import { HoverEffect } from './ui/card-hover-effect';

interface Earning {
  id: number;
  fromAddress: string;
  level: number;
  amount: number;
  isClaimed: boolean;
  txHash: string | null;
  timestamp: string;
}

export default function NetworksTab() {
  const { userAddress, jwtToken } = useWeb3();
  const [stats, setStats] = useState({ totalEarned: 0, availableEarned: 0, claimedEarned: 0 });
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', show: false, isError: false });

  const showToast = (message: string, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadNetworkData = async () => {
    if (!jwtToken) return;
    try {
      setLoading(true);
      const res = await fetch('/api/user/network/stats', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
        setEarnings(data.earningsHistory);
      } else {
        showToast(data.error || "Failed to load network stats", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Network statistics lookup failed.", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetworkData();
  }, [jwtToken]);

  const handleRedeem = async () => {
    if (stats.availableEarned <= 0) {
      showToast("No available network earnings to redeem.", true);
      return;
    }
    try {
      setRedeemLoading(true);
      showToast("Processing network reward redemption on-chain... Please wait.", false);

      const res = await fetch('/api/user/network/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`Successfully redeemed ${data.amount.toFixed(2)} ARES directly to MetaMask!`, false);
        await loadNetworkData();
      } else {
        showToast(data.error || "Redemption failed.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Error processing redemption transaction.", true);
    } finally {
      setRedeemLoading(false);
    }
  };

  // ─── Shared Section Helpers ───
  const Section = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-emerald-500/20 hover:bg-[#111113]/90 hover:shadow-[0_4px_30px_-4px_rgba(16,185,129,0.1)] ${className}`}>
      {children}
    </div>
  );

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></div>
      {children}
    </div>
  );

  const SectionTitle = ({ children, icon }: { children: React.ReactNode; icon?: string }) => (
    <h2 className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight mb-1 flex items-center gap-2">
      {icon && <span className="text-base opacity-90 drop-shadow-md">{icon}</span>}
      {children}
    </h2>
  );

  const SectionDesc = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[13px] text-zinc-400 leading-relaxed mb-6 font-medium">{children}</p>
  );

  const StatCard = ({ label, value, color = 'text-white', sub }: { label: string; value: string | number; color?: string; sub?: string }) => (
    <div className="bg-black/40 rounded-xl px-4 py-3.5 border border-white/5 hover:border-white/10 transition-colors shadow-inner">
      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-[16px] font-bold ${color} tabular-nums tracking-tight`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-1 font-medium">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* ── Toast Notification ── */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl text-[13px] font-medium transition-all ${toast.isError
            ? 'bg-red-950/90 border-red-800/40 text-red-300'
            : 'bg-emerald-950/90 border-emerald-800/40 text-emerald-300'
          }`}>
          <i className={`fa-solid ${toast.isError ? 'fa-circle-exclamation' : 'fa-circle-check'} text-[13px]`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Top Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1 — Available Matching Earnings */}
        <Section className="flex flex-col justify-between">
          <div>
            <SectionLabel>Available Matching Earnings</SectionLabel>
            <div className="text-2xl font-semibold text-white mt-2 font-mono">
              {stats.availableEarned.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} <span className="text-[12px] text-[#6e6e80] ml-1">ARES</span>
            </div>
            <p className="text-[13px] text-[#8e8ea0] mt-3 leading-relaxed">
              Earned when downlines claimed their yield. Direct-to-wallet transfer.
            </p>
          </div>
          <button
            onClick={handleRedeem}
            disabled={redeemLoading || stats.availableEarned <= 0}
            className="mt-6 w-full py-2.5 bg-white text-black font-semibold rounded-xl text-sm hover:bg-[#e4e4e7] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {redeemLoading ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Redeeming...</>
            ) : (
              <><i className="fa-solid fa-download" /> Redeem to Wallet</>
            )}
          </button>
        </Section>

        {/* Card 2 — Total Earned (Lifetime) */}
        <Section className="flex flex-col justify-between">
          <div>
            <SectionLabel>Total Earned (Lifetime)</SectionLabel>
            <div className="text-2xl font-semibold text-emerald-400 mt-2 font-mono">
              {stats.totalEarned.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} <span className="text-[12px] text-[#6e6e80] ml-1">ARES</span>
            </div>
            <p className="text-[13px] text-[#8e8ea0] mt-3 leading-relaxed">
              Total network-based commission accrued from your downline tree.
            </p>
          </div>
          <div className="mt-6">
            <span className="inline-block text-[11px] text-[#6e6e80] font-mono bg-[#0c0c0e] border border-[#1e1e22] px-2.5 py-1.5 rounded-lg">
              Directly from downlines
            </span>
          </div>
        </Section>

        {/* Card 3 — Total Redeemed */}
        <Section className="flex flex-col justify-between">
          <div>
            <SectionLabel>Total Redeemed</SectionLabel>
            <div className="text-2xl font-semibold text-[#8e8ea0] mt-2 font-mono">
              {stats.claimedEarned.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} <span className="text-[12px] text-[#6e6e80] ml-1">ARES</span>
            </div>
            <p className="text-[13px] text-[#8e8ea0] mt-3 leading-relaxed">
              Matching commissions successfully withdrawn to your primary wallet.
            </p>
          </div>
          <div className="mt-6">
            <span className="inline-block text-[11px] text-[#6e6e80] font-mono bg-[#0c0c0e] border border-[#1e1e22] px-2.5 py-1.5 rounded-lg">
              Transaction fees: 0%
            </span>
          </div>
        </Section>

      </div>

      {/* ── Earnings History Card ── */}
      <Section>
        {/* Header row */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <SectionLabel>Commissions History</SectionLabel>
            <SectionTitle icon="📜">Downline Claims & Matching Commissions</SectionTitle>
            <SectionDesc>Live feed of matching rewards generated when members of your downline claim yield.</SectionDesc>
          </div>
          <button
            onClick={loadNetworkData}
            disabled={loading}
            className="flex-shrink-0 ml-4 bg-[#0c0c0e] border border-[#1e1e22] text-[#6e6e80] hover:text-white hover:border-[#3a3a42] rounded-xl w-10 h-10 flex items-center justify-center transition-all disabled:opacity-40"
            title="Refresh network data"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`} />
          </button>
        </div>

        <div className="w-full">
          {earnings.length === 0 ? (
            <div className="py-10 text-center text-[#4e4e5c] text-sm border border-dashed border-[#1e1e22] rounded-xl">
              No matching commissions generated yet. When your downline claims yield, it will appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {earnings.map((e, index) => {
                const abbrFrom = `${e.fromAddress.substring(0, 6)}...${e.fromAddress.substring(38)}`;
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c0c0e] border border-[#1a1a1e] rounded-xl px-4 py-3 group hover:border-[#2a2a30] transition-colors">
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <i className="fa-solid fa-arrow-down text-sm" />
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-white">+{e.amount.toFixed(4)} ARES</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-[#6e6e80]">From: <span className="text-cyan-400/80">{abbrFrom}</span></span>
                          <span className="w-1 h-1 rounded-full bg-[#1e1e22]" />
                          <span className="text-[11px] font-semibold text-[#8e8ea0]">Lvl {e.level}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1e1e22]">
                      <div className="text-left sm:text-right">
                        <div className="text-[11px] text-[#6e6e80]">{new Date(e.timestamp).toLocaleString()}</div>
                        {e.txHash && (
                          <a
                            href={`http://localhost:9081/tx/${e.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-0.5 font-mono text-[10px] text-[#6e6e80] hover:text-cyan-400 transition-colors"
                          >
                            Tx: {e.txHash.substring(0, 6)}…
                          </a>
                        )}
                      </div>
                      
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border flex-shrink-0 ${
                        e.isClaimed
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {e.isClaimed ? 'Redeemed' : 'Unclaimed'}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </Section>

    </div>
  );
}

