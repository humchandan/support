'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';

export default function LandingView() {
  const { connectWallet, registerUser, userAddress, loading } = useWeb3();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [referrer, setReferrer] = useState('0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17');
  const [referrerFrozen, setReferrerFrozen] = useState(false);

  useEffect(() => {
    // Parse query params for ref address
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref');
      if (refParam && refParam.startsWith('0x') && refParam.length === 42) {
        setReferrer(refParam.toLowerCase());
        setReferrerFrozen(true);
      }
    }
  }, []);

  const handleRegister = async () => {
    if (!name || !mobile) {
      alert("Name and mobile number are required!");
      return;
    }
    const res = await registerUser(name, mobile, referrer);
    if (!res.success) {
      alert(res.error || "Registration failed.");
    }
  };

  const formattedAddress = userAddress 
    ? `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`
    : '';

  return (
    <div id="landing-view">
      {/* Landing Top Bar */}
      <header className="revolut-header">
        <div className="header-container">
          <div className="brand-logo">
            Aries<span className="dot">.</span>
          </div>
          <div className="header-actions">
            {userAddress ? (
              <div className="connection-status" style={{ marginRight: '1rem' }}>
                <span className="status-indicator online"></span>
                <span style={{ fontFamily: 'monospace' }}>{formattedAddress}</span>
              </div>
            ) : (
              <button className="btn-connect" onClick={connectWallet} disabled={loading}>
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="revolut-container" style={{ marginTop: '4rem' }}>
        {/* Hero Title */}
        <section style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-2px', marginBottom: '1rem', lineHeight: 1.1 }}>
            Sovereign Staking, MLM Nodes &amp; Utility Payments.
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '700px', margin: '0 auto 2rem auto', lineHeight: 1.5 }}>
            Aries connects secure validation yields with a dynamic EIP-1167 proxy payment gateway and 10 levels of community matching incentives, driven by a self-sustaining circular token economy.
          </p>
        </section>

        {/* Section: ARES Capabilities */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '1.5rem', textAlign: 'center' }}>What You Can Do with ARES</h2>
          <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="revolut-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(25, 112, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
                  <i className="fa-solid fa-chart-line" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <h3 className="card-title">Validator Staking</h3>
                <p className="card-desc" style={{ marginBottom: 0, fontSize: '0.95rem' }}>Buy non-refundable validation plans (minimum 1,000 ARES, in multiples of 100 ARES) to earn a steady 8.33% monthly yield from staking. These funds secure the validator nodes of the Aries blockchain.</p>
              </div>
            </div>

            <div className="revolut-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(0, 210, 122, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--success-color)' }}>
                  <i className="fa-solid fa-wallet" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <h3 className="card-title">EIP-1167 Proxy Wallets</h3>
                <p className="card-desc" style={{ marginBottom: 0, fontSize: '0.95rem' }}>Deploy individual, low-gas, minimal proxy deposit contracts that forward native tokens to the custodial vault while crediting off-chain ledger balances, facilitating easy and secure fund sweeps.</p>
              </div>
            </div>

            <div className="revolut-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--warning-color)' }}>
                  <i className="fa-solid fa-arrow-right-arrow-left" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <h3 className="card-title">Instant Internal Transfers</h3>
                <p className="card-desc" style={{ marginBottom: 0, fontSize: '0.95rem' }}>Transfer utility credit between users inside the portal instantly. It operates off-chain via secure ledgers, bypassing block confirmation delays, at a minor 5% ecosystem recycling fee.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Detailed MLM Portal Objectives & Sustenance Model */}
        <section className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
          {/* MLM Portal Objectives */}
          <div className="revolut-card">
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(25, 112, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
              <i className="fa-solid fa-sitemap" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <h3 className="card-title" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>MLM Portal Objective</h3>
            <p className="card-desc" style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              Our primary objective is to coordinate staking support to help bootstrap and secure validator node consensus on the Aries Network. The multi-level marketing (MLM) structure is designed to incentivize cooperative network growth:
            </p>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '1.25rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong>Sponsor Incentive:</strong> Leverage your network to earn matching yield payouts across 10 referral levels.</li>
              <li><strong>Leadership Ranks:</strong> Climb through 6 ranks (Bronze, Silver, Gold, Diamond, Crown) by sponsoring direct active accounts and expanding team volume.</li>
              <li><strong>Level Unlocks:</strong> Rank upgrades open deeper levels of matching bonuses (up to 10% matching payouts at Crown level).</li>
            </ul>
          </div>

          {/* The Sustenance Economics Model */}
          <div className="revolut-card" style={{ borderColor: 'rgba(0, 210, 122, 0.3)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(0, 210, 122, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--success-color)' }}>
              <i className="fa-solid fa-recycle" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <h3 className="card-title" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>The Sustenance Economics Model</h3>
            <p className="card-desc" style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              To guarantee the long-term platform viability and treasury liquidity, Aries implements a self-stabilizing circular model that recycles token velocity:
            </p>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '1.25rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong>10% Claim Administration Fee:</strong> Every rewards claim is subject to a 10% administration fee, redirected back to secure validator node costs.</li>
              <li><strong>50/50 Split Payout Guard:</strong> Net claim payouts are split: 50% routes directly to MetaMask (liquid), and 50% is credited to your utility portal wallet to support payment services. This maintains high demand for portal utility.</li>
              <li><strong>5% Internal Transfer Fee:</strong> Internal transfers carry a 5% fee, recycled to treasury nodes.</li>
              <li><strong>200% Payout Cap (2x):</strong> All active plans are subject to a hard 2x payout cap (Staking + MLM rewards). Once reached, withdrawals lock. Buying a top-up plan is required to reset and expand your cap capacity.</li>
            </ul>
          </div>
        </section>

        {/* Registration Form Card */}
        <section style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="revolut-card" id="registration-card" style={{ borderColor: 'var(--primary-color)' }}>
            <h3 className="card-title" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Activate Your Account</h3>
            <p className="card-desc" style={{ textAlign: 'center' }}>Enter your registration details. A referrer address is required to join the MLM matching portal.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-name">Full Name</label>
                <input 
                  type="text" 
                  id="reg-name" 
                  placeholder="John Doe" 
                  style={{ background: '#16171e' }} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-mobile">Mobile Number</label>
                <input 
                  type="text" 
                  id="reg-mobile" 
                  placeholder="+1 (555) 123-4567" 
                  style={{ background: '#16171e' }} 
                  value={mobile} 
                  onChange={(e) => setMobile(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="reg-referrer">Referrer Address (Upline)</label>
                <input 
                  type="text" 
                  id="reg-referrer" 
                  placeholder="0x..." 
                  style={{ background: '#16171e', opacity: referrerFrozen ? '0.7' : '1' }} 
                  readOnly={referrerFrozen} 
                  value={referrer} 
                  onChange={(e) => setReferrer(e.target.value)} 
                />
              </div>

              {/* Wallet Warning / Button */}
              {!userAddress ? (
                <div id="reg-wallet-warning" style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', color: 'var(--danger-color)', marginBottom: '0.5rem' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i> Please connect your MetaMask wallet to register.
                </div>
              ) : null}

              {userAddress ? (
                <button className="btn-primary" onClick={handleRegister} disabled={loading}>
                  {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Complete Registration'}
                </button>
              ) : (
                <button className="btn-primary" onClick={connectWallet} disabled={loading}>
                  Connect Wallet to Register
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
