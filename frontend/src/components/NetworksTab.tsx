'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';

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

  return (
    <div className="space-y-6">

      {/* ── Toast Notification ── */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium transition-all duration-300 ${
            toast.isError
              ? 'bg-red-950/90 border-red-800/60 text-red-200'
              : 'bg-zinc-900 border-zinc-700/60 text-zinc-100'
          }`}
        >
          <i
            className={
              toast.isError
                ? 'fa-solid fa-circle-exclamation text-red-400'
                : 'fa-solid fa-circle-check text-emerald-400'
            }
          />
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Top Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* Card 1 — Available Matching Earnings */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/50 transition-all flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
              Available Matching Earnings
            </p>
            <div className="text-2xl font-black text-white">
              {stats.availableEarned.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">ARES</p>
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              Earned when downlines claimed their yield. Direct-to-wallet transfer.
            </p>
          </div>
          <button
            onClick={handleRedeem}
            disabled={redeemLoading || stats.availableEarned <= 0}
            className="mt-6 w-full py-3.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {redeemLoading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin" /> Redeeming...
              </>
            ) : (
              <>
                <i className="fa-solid fa-download" /> Redeem to MetaMask
              </>
            )}
          </button>
        </div>

        {/* Card 2 — Total Earned (Lifetime) */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/50 transition-all flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
              Total Earned (Lifetime)
            </p>
            <div className="text-2xl font-black text-emerald-400">
              {stats.totalEarned.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">ARES</p>
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              Total network-based commission accrued from your downline tree.
            </p>
          </div>
          <span className="mt-6 self-start text-[11px] text-zinc-500 font-mono bg-zinc-950/60 border border-zinc-800/40 px-3 py-1 rounded-full">
            Directly from downlines
          </span>
        </div>

        {/* Card 3 — Total Redeemed */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/50 transition-all flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
              Total Redeemed
            </p>
            <div className="text-2xl font-black text-zinc-400">
              {stats.claimedEarned.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">ARES</p>
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              Matching commissions successfully withdrawn to your primary wallet.
            </p>
          </div>
          <span className="mt-6 self-start text-[11px] text-zinc-500 font-mono bg-zinc-950/60 border border-zinc-800/40 px-3 py-1 rounded-full">
            Transaction fees: 0%
          </span>
        </div>

      </div>

      {/* ── Earnings History Card ── */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8">

        {/* Header row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Commissions History
            </p>
            <h3 className="text-xl font-bold text-white tracking-tight mb-1.5">
              Downline Claims &amp; Matching Commissions
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Live feed of matching rewards generated when members of your downline claim yield.
            </p>
          </div>
          <button
            onClick={loadNetworkData}
            disabled={loading}
            className="flex-shrink-0 ml-4 bg-zinc-950/60 border border-zinc-800/40 text-zinc-400 hover:text-white hover:border-zinc-700/50 rounded-xl p-2.5 text-xs transition-all disabled:opacity-50"
            title="Refresh network data"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`} />
          </button>
        </div>

        <div className="h-px bg-zinc-800/60 mb-6" />

        {/* ── Desktop Table ── */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-zinc-800/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-950/60 border-b border-zinc-800/40">
                {['From Downline', 'Tree Depth', 'Matching Yield', 'Status', 'Timestamp', 'On-chain Hash'].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide ${
                        i === 5 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {earnings.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-zinc-600 text-sm"
                  >
                    No matching commissions generated yet. When your downline claims yield, it will appear here.
                  </td>
                </tr>
              ) : (
                earnings.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-400">
                      {e.fromAddress.substring(0, 6)}…{e.fromAddress.substring(38)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-zinc-950/60 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded border border-zinc-800/40">
                        Level {e.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      +{e.amount.toFixed(4)} ARES
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          e.isClaimed
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}
                      >
                        {e.isClaimed ? 'Redeemed' : 'Unclaimed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.txHash ? (
                        <a
                          href="http://localhost"
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                        >
                          {e.txHash.substring(0, 6)}…{e.txHash.substring(60)}
                        </a>
                      ) : (
                        <span className="text-zinc-700 italic text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="block md:hidden space-y-3">
          {earnings.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 text-sm">
              No matching commissions generated yet.
            </div>
          ) : (
            earnings.map((e) => (
              <div
                key={e.id}
                className="bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-4 space-y-3"
              >
                {/* Top row: level badge + amount + status */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="bg-zinc-900 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded border border-zinc-800/40">
                      Level {e.level}
                    </span>
                    <p className="font-bold text-white text-sm mt-1.5">
                      +{e.amount.toFixed(4)} ARES
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      e.isClaimed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}
                  >
                    {e.isClaimed ? 'Redeemed' : 'Unclaimed'}
                  </span>
                </div>

                {/* Meta details */}
                <div className="text-xs text-zinc-500 space-y-1.5">
                  <div>
                    <span className="text-zinc-600 font-semibold">From Downline: </span>
                    <span className="font-mono text-blue-400">
                      {e.fromAddress.substring(0, 6)}…{e.fromAddress.substring(38)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-600 font-semibold">Timestamp: </span>
                    {new Date(e.timestamp).toLocaleString()}
                  </div>
                  {e.txHash && (
                    <div className="pt-2 border-t border-zinc-800/40 mt-2">
                      <span className="text-zinc-600 font-semibold">Redeem Hash: </span>
                      <span className="font-mono text-blue-400 break-all text-[11px]">
                        {e.txHash}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
}
