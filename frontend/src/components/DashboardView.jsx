'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';
import WealthTab from './WealthTab';
import PaymentsTab from './PaymentsTab';
import ProfileTab from './ProfileTab';

export default function DashboardView() {
  const { userAddress, provider, userProfile, disconnectWallet } = useWeb3();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('wealth'); // 'wealth' | 'payments' | 'profile'
  const [ethBalance, setEthBalance] = useState(0);

  // Poll user wallet balance
  useEffect(() => {
    if (!provider || !userAddress) return;

    const fetchBalance = async () => {
      try {
        const bal = await provider.getBalance(userAddress);
        setEthBalance(parseFloat(ethers.formatEther(bal)));
      } catch (err) {
        console.error("Failed to query wallet balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000); // 30s — avoid RPC spam
    return () => clearInterval(interval);
  }, [provider, userAddress]);

  const formattedAddress = userAddress 
    ? `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`
    : 'Not connected';

  const selfInvestment = userProfile?.selfInvestment || 0;
  const totalBalance = ethBalance + selfInvestment;

  return (
    <div id="dashboard-view" className="w-full">
      {/* Top Bar Header */}
      <header className="revolut-header">
        <div className="header-container">
          <div className="flex items-center gap-8">
            <div className="brand-logo">
              Aries<span className="dot">.</span>
            </div>
            
            {/* Header Navigation */}
            <nav className="hidden sm:flex items-center gap-4 text-sm font-semibold">
              <button 
                className="text-white bg-[#252836] rounded-full px-4 py-1.5 transition-colors cursor-default"
              >
                <i className="fa-solid fa-sitemap mr-1.5"></i> MLM Dashboard
              </button>
              <button 
                onClick={() => router.push('/portal')}
                className="text-zinc-400 hover:text-white px-3 py-1.5 transition-colors"
              >
                <i className="fa-solid fa-wallet mr-1.5"></i> Utility Portal
              </button>
            </nav>
          </div>
          <div className="header-actions">
            <div className="connection-status">
              <span className="status-indicator online"></span>
              <span>Aries Network</span>
            </div>
            <button className="btn-connect" onClick={disconnectWallet} title="Click to disconnect">
              <i className="fa-solid fa-circle-check"></i> {formattedAddress}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="revolut-container">
        
        {/* Balance Hero Section */}
        <section className="balance-hero">
          <div className="balance-label">Total balance</div>
          <div className="balance-amount">
            {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="currency">ARES</span>
          </div>
          <div className="wallet-address-sub">{userAddress}</div>
        </section>

        {/* Segmented Tab Link Navigation */}
        <nav className="revolut-tabs" style={{ maxWidth: '600px' }}>
          <button 
            className={`tab-link ${activeTab === 'wealth' ? 'active' : ''}`} 
            onClick={() => setActiveTab('wealth')}
          >
            <i className="fa-solid fa-chart-line"></i>
            <span>Wealth &amp; Invest</span>
          </button>
          <button 
            className={`tab-link ${activeTab === 'payments' ? 'active' : ''}`} 
            onClick={() => setActiveTab('payments')}
          >
            <i className="fa-solid fa-arrow-right-arrow-left"></i>
            <span>Transfers &amp; Payments</span>
          </button>
          <button 
            className={`tab-link ${activeTab === 'profile' ? 'active' : ''}`} 
            onClick={() => setActiveTab('profile')}
          >
            <i className="fa-solid fa-user"></i>
            <span>Profile Settings</span>
          </button>
        </nav>

        {/* Tab Contents */}
        {activeTab === 'wealth' ? (
          <WealthTab />
        ) : activeTab === 'payments' ? (
          <PaymentsTab />
        ) : (
          <ProfileTab />
        )}

      </main>
    </div>
  );
}
