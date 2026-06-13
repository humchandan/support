'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { useRouter } from 'next/navigation';
import WalletConnectModal from './WalletConnectModal';

export default function RevolutLanding() {
  const { 
    connectWallet, 
    registerUser, 
    userAddress, 
    userProfile, 
    loading,
    isConnectModalOpen,
    setIsConnectModalOpen,
    connectingWalletId,
    connectToWallet
  } = useWeb3();
  const router = useRouter();

  const [showRegModal, setShowRegModal] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [referrer, setReferrer] = useState('0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17');
  const [referrerFrozen, setReferrerFrozen] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref');
      if (refParam && refParam.startsWith('0x') && refParam.length === 42) {
        setReferrer(refParam.toLowerCase());
        setReferrerFrozen(true);
      }
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (userAddress && userProfile) {
      router.push('/app');
    } else if (userAddress && !userProfile) {
      setShowRegModal(true);
    }
  }, [userAddress, userProfile, router]);

  // Rotate feature tabs
  useEffect(() => {
    const t = setInterval(() => setActiveTab(p => (p + 1) % 4), 4000);
    return () => clearInterval(t);
  }, []);

  const handleLaunchApp = async () => {
    if (userAddress && userProfile) {
      router.push('/app');
    } else if (userAddress && !userProfile) {
      setShowRegModal(true);
    } else {
      await connectWallet();
    }
  };

  const handleRegister = async () => {
    if (!name || !mobile) { alert('Name and mobile are required'); return; }
    setRegLoading(true);
    const res = await registerUser(name, mobile, referrer);
    setRegLoading(false);
    if (res.success) { setShowRegModal(false); router.push('/app'); }
    else alert(res.error || 'Registration failed.');
  };

  const navLinks = [
    { label: 'Why ARES', href: '#why' },
    { label: 'Benefits', href: '#benefits' },
    { label: 'Ecosystem', href: '#ecosystem' },
    { label: 'Projects', href: '#projects' },
  ];

  const stats = [
    { value: '< 1s', label: 'Block finality' },
    { value: '$0.001', label: 'Avg tx fee' },
    { value: '10,000+', label: 'TPS capacity' },
    { value: '100%', label: 'Open source' },
  ];

  const whyAres = [
    {
      icon: 'fa-bolt',
      color: '#f59e0b',
      title: 'Blazing Fast',
      body: 'Aries confirms transactions in under 1 second — 1,000× faster than Ethereum\'s 12-second block time. Real-time payments, no waiting.',
    },
    {
      icon: 'fa-feather',
      color: '#34d399',
      title: 'Near-Zero Fees',
      body: 'Ethereum gas fees regularly exceed $5–50 per transaction. ARES fees average $0.001 — making micropayments and NFT minting economically viable.',
    },
    {
      icon: 'fa-leaf',
      color: '#60a5fa',
      title: 'Energy Efficient',
      body: 'Our delegated proof-of-stake consensus uses 99.9% less energy than Ethereum\'s legacy proof-of-work. A greener chain for a greener future.',
    },
    {
      icon: 'fa-shield-halved',
      color: '#a78bfa',
      title: 'EVM Compatible',
      body: 'All Ethereum smart contracts deploy on Aries without modification. Developers get the full Solidity toolchain with none of the cost overhead.',
    },
    {
      icon: 'fa-people-group',
      color: '#fb7185',
      title: 'Community Owned',
      body: 'No VC-controlled treasury. ARES is distributed through staking rewards, referral incentives, and ecosystem grants voted on by holders.',
    },
    {
      icon: 'fa-globe',
      color: '#38bdf8',
      title: 'Built for Real Use',
      body: 'Aries is purpose-built for utility spending — pay bills, stream payments, mint NFTs, and reward creators without leaving the ecosystem.',
    },
  ];

  const featureTabs = [
    {
      label: 'Staking',
      icon: 'fa-layer-group',
      headline: 'Earn 8.33% monthly staking yields',
      body: 'Lock your ARES into a validator node plan and receive automatic monthly staking rewards. Your funds secure the Aries consensus network while generating passive income. Plans start from 1,000 ARES.',
      badge: '8.33% / mo',
      badgeColor: '#34d399',
      visual: (
        <div style={{ background: '#0d0e12', borderRadius: 16, padding: 24, border: '1px solid #1a1c24' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Active Node Yield</div>
          {[['Bronze Node', '1,000 ARES', '83 ARES/mo'], ['Silver Node', '5,000 ARES', '416 ARES/mo'], ['Gold Node', '10,000 ARES', '833 ARES/mo']].map(([tier, stake, yield_]) => (
            <div key={tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1a1c24' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tier}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{stake} locked</div>
              </div>
              <div style={{ color: '#34d399', fontWeight: 700, fontSize: 14 }}>{yield_}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      label: 'NFT Minting',
      icon: 'fa-image',
      headline: 'Make your memories immortal on-chain',
      body: 'Upload any photo to our Family Tree dApp, pay in ARES, and receive a permanent NFT on the Aries blockchain. Your image becomes an immutable, verifiable token — owned forever, censorship-resistant, never deletable.',
      badge: 'Coming Q3 2025',
      badgeColor: '#818cf8',
      visual: (
        <div style={{ background: '#0d0e12', borderRadius: 16, padding: 24, border: '1px solid #1a1c24' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {['#1e3a5f', '#2d1b4e', '#1a3a2a', '#3a1a1a', '#1a2a3a', '#2d2a1a'].map((bg, i) => (
              <div key={i} style={{ background: bg, borderRadius: 8, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1a1c24' }}>
                <i className="fa-solid fa-image" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }} />
              </div>
            ))}
          </div>
          <div style={{ background: '#111218', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#a78bfa' }}><i className="fa-solid fa-certificate" /> NFT Minted</span>
            <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>0x9f3d...c12a</span>
          </div>
        </div>
      )
    },
    {
      label: 'Superchat',
      icon: 'fa-comments-dollar',
      headline: 'Decentralised payments for every streamer',
      body: 'Aries Superchat lets content creators accept viewer contributions in ARES directly — no platform middleman, no 30% cut, no chargebacks. Works with any live streaming platform via browser extension.',
      badge: 'Coming Q4 2025',
      badgeColor: '#f59e0b',
      visual: (
        <div style={{ background: '#0d0e12', borderRadius: 16, padding: 20, border: '1px solid #1a1c24' }}>
          {[
            { user: 'CryptoFan_99', msg: 'Great stream! Keep building! 🔥', ares: '50 ARES', color: '#f59e0b' },
            { user: 'blockchain_dev', msg: 'Aries is the future of Web3', ares: '200 ARES', color: '#a78bfa' },
            { user: 'nft_collector', msg: 'Love the family tree project idea!', ares: '25 ARES', color: '#34d399' },
          ].map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, padding: 10, background: '#111218', borderRadius: 10, border: `1px solid ${c.color}22` }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-user" style={{ color: c.color, fontSize: 12 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.user}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.ares}</span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{c.msg}</div>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      label: 'Utility Pay',
      icon: 'fa-wallet',
      headline: 'Pay your bills directly with ARES',
      body: 'Reload mobile credit, pay electricity & broadband bills, or buy gift cards using your Aries utility balance. Your ARES earnings flow directly to real-world spending — no conversion, no exchange needed.',
      badge: 'Live Now',
      badgeColor: '#34d399',
      visual: (
        <div style={{ background: '#0d0e12', borderRadius: 16, padding: 20, border: '1px solid #1a1c24' }}>
          {[
            { icon: 'fa-mobile-screen', label: 'Mobile Recharge', sub: 'Aries Mobile LTE', color: '#60a5fa' },
            { icon: 'fa-lightbulb', label: 'Electricity Bill', sub: 'Aries Power Corp', color: '#f59e0b' },
            { icon: 'fa-wifi', label: 'Broadband', sub: 'Aries Fiber Optic', color: '#34d399' },
            { icon: 'fa-gift', label: 'Gift Cards', sub: 'Amazon, Google Play...', color: '#a78bfa' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid #1a1c24' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fa-solid ${item.icon}`} style={{ color: item.color, fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{item.sub}</div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ color: '#374151', fontSize: 10, marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      )
    },
  ];

  const projects = [
    {
      tag: 'Ecosystem • Coming Q3 2025',
      tagColor: '#818cf8',
      icon: 'fa-tree',
      iconBg: '#818cf8',
      title: 'Aries Family Tree',
      subtitle: 'Your photos. Immortalised on blockchain.',
      desc: 'Connect your Instagram, select family photos, and mint them as NFTs on the Aries chain for a one-time ARES payment. Each image becomes a permanent, censorship-proof digital heirloom — linked in a visual family tree that anyone in your family can view, but only you own.',
      bullets: ['Pay once in ARES — own your images forever', 'Instagram & photo library integration', 'Immutable on-chain storage via IPFS', 'Shareable family tree viewer link'],
      gradient: 'linear-gradient(135deg, #1a1040 0%, #0d0e12 100%)',
      accentColor: '#818cf8',
    },
    {
      tag: 'Ecosystem • Coming Q4 2025',
      tagColor: '#f59e0b',
      icon: 'fa-satellite-dish',
      iconBg: '#f59e0b',
      title: 'Aries Superchat',
      subtitle: 'Monetise your stream. Keep everything.',
      desc: 'A browser-based overlay tool that lets any streamer — on Twitch, YouTube Live, or any platform — accept ARES tip payments from their viewers directly to their wallet. No platform fee, no chargebacks, no KYC for viewers. Just peer-to-peer value transfer.',
      bullets: ['Works as a browser extension overlay', 'Real-time on-screen tip alerts', '0% platform cut — 100% to creators', 'Viewer leaderboard & tipping history'],
      gradient: 'linear-gradient(135deg, #1a0f00 0%, #0d0e12 100%)',
      accentColor: '#f59e0b',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#ffffff', fontFamily: "'Inter', -apple-system, sans-serif", overflowX: 'hidden' }}>

      {/* ── STICKY NAV ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 2rem', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(0,0,0,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: -1 }}>
          Aries<span style={{ color: '#1970ff' }}>.</span>
        </div>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="hidden md:flex">
          {navLinks.map(l => (
            <a key={l.label} href={l.href} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.6)'}
            >{l.label}</a>
          ))}
        </nav>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={handleLaunchApp} disabled={loading} style={{
            background: '#ffffff', color: '#000000',
            border: 'none', borderRadius: 9999,
            fontWeight: 700, fontSize: 15, padding: '10px 24px',
            cursor: 'pointer', transition: 'all 0.2s',
            opacity: loading ? 0.7 : 1,
          }}
            onMouseEnter={e => { e.target.style.transform = 'scale(1.03)'; e.target.style.background = '#e5e7eb'; }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.background = '#fff'; }}
          >
            {loading ? <><i className="fa-solid fa-spinner fa-spin" /> &nbsp;Loading</> : userAddress ? 'Open App →' : 'Get started'}
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{ paddingTop: 160, paddingBottom: 120, paddingLeft: 24, paddingRight: 24, maxWidth: 1140, margin: '0 auto', textAlign: 'center' }}>

        {/* Tag pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          border: '1px solid rgba(25,112,255,0.3)', borderRadius: 9999,
          padding: '6px 16px', marginBottom: 32, background: 'rgba(25,112,255,0.06)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1970ff', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 13, color: '#60a5fa', fontWeight: 600, letterSpacing: 0.5 }}>Aries Blockchain — Mainnet Live</span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 'clamp(48px, 8vw, 88px)',
          fontWeight: 900, lineHeight: 1.02, letterSpacing: -2,
          marginBottom: 28, maxWidth: 900, margin: '0 auto 28px auto',
          background: 'linear-gradient(180deg, #ffffff 40%, rgba(255,255,255,0.45) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          One chain.<br />Infinite possibilities.
        </h1>

        {/* Sub */}
        <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)', fontWeight: 400, maxWidth: 600, margin: '0 auto 48px auto', lineHeight: 1.6 }}>
          Aries is a next-generation blockchain built for speed, utility, and real-world adoption — with near-zero fees, NFT minting, creator payments, and on-chain bill settlements.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 80 }}>
          <button onClick={handleLaunchApp} disabled={loading} style={{
            background: '#1970ff', color: '#fff',
            border: 'none', borderRadius: 9999,
            fontWeight: 700, fontSize: 17, padding: '16px 36px',
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: '0 0 40px rgba(25,112,255,0.25)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#3888ff'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1970ff'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Connect Wallet &nbsp;<i className="fa-solid fa-arrow-right" />
          </button>
          <a href="#why" style={{
            background: 'rgba(255,255,255,0.06)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9999,
            fontWeight: 600, fontSize: 17, padding: '16px 36px',
            textDecoration: 'none', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          >
            Explore the chain
          </a>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ padding: '28px 20px', textAlign: 'center', background: '#0a0a0a' }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 34, fontWeight: 900, letterSpacing: -1, color: '#fff', marginBottom: 6 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY ARES ── */}
      <section id="why" style={{ padding: '100px 24px', maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ fontSize: 13, color: '#1970ff', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Why Aries</div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, marginBottom: 20 }}>
            Everything Ethereum promised.<br />Actually delivered.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 18, maxWidth: 560, margin: '0 auto' }}>
            We built Aries from first principles — removing the bottlenecks that prevent crypto from reaching everyday people.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {whyAres.map((item, i) => (
            <div key={i} style={{
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, padding: 32,
              transition: 'all 0.3s ease', cursor: 'default',
            }}
              onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${item.color}33`; e.currentTarget.style.background = '#0d0d0d'; }}
              onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'; e.currentTarget.style.background = '#0a0a0a'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <i className={`fa-solid ${item.icon}`} style={{ color: item.color, fontSize: 20 }} />
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{item.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.65 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section id="benefits" style={{ padding: '80px 24px', background: '#050506' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 13, color: '#34d399', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>ARES vs ETH</div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: -2 }}>
              The numbers don't lie.
            </h2>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', background: '#0d0e12', padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Feature</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', textAlign: 'center' }}>ARES</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Ethereum</div>
            </div>
            {/* Rows */}
            {[
              ['Transaction Speed', '< 1 second', '12–15 seconds'],
              ['Average Fee', '$0.001', '$5–$50'],
              ['TPS (Transactions/sec)', '10,000+', '~15 TPS'],
              ['NFT Mint Cost', '~$0.01', '$20–$200+'],
              ['Energy Consumption', 'Minimal (DPoS)', 'High (Merged PoS)'],
              ['EVM Compatible', '✓ Yes', '✓ Yes'],
              ['Utility Bill Payments', '✓ Native support', '✗ Not built-in'],
              ['Creator Payment Tools', '✓ Superchat dApp', '✗ Third-party only'],
            ].map(([feat, ares, eth], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '16px 28px', borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: i % 2 === 0 ? '#080809' : '#0a0a0a' }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{feat}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#34d399', textAlign: 'center' }}>{ares}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{eth}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE TABS ── */}
      <section id="ecosystem" style={{ padding: '100px 24px', maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Ecosystem</div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, letterSpacing: -2, marginBottom: 20 }}>
            One ecosystem.<br />Everything you need.
          </h2>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 48, flexWrap: 'wrap' }}>
          {featureTabs.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{
              padding: '10px 22px', borderRadius: 9999, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === i ? '#ffffff' : 'rgba(255,255,255,0.06)',
              color: activeTab === i ? '#000000' : 'rgba(255,255,255,0.5)',
              border: '1px solid ' + (activeTab === i ? '#fff' : 'rgba(255,255,255,0.1)'),
            }}>
              <i className={`fa-solid ${tab.icon} mr-2`} />{tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: 48 }} className="feature-tab-grid">
          <div>
            <div style={{ display: 'inline-block', background: featureTabs[activeTab].badgeColor + '20', color: featureTabs[activeTab].badgeColor, padding: '4px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 700, marginBottom: 20, border: `1px solid ${featureTabs[activeTab].badgeColor}40` }}>
              {featureTabs[activeTab].badge}
            </div>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1, marginBottom: 16 }}>
              {featureTabs[activeTab].headline}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
              {featureTabs[activeTab].body}
            </p>
            <button onClick={handleLaunchApp} style={{ background: '#1970ff', color: '#fff', border: 'none', borderRadius: 9999, fontWeight: 700, fontSize: 15, padding: '12px 28px', cursor: 'pointer' }}>
              Get started →
            </button>
          </div>
          <div>{featureTabs[activeTab].visual}</div>
        </div>
      </section>

      {/* ── UPCOMING PROJECTS ── */}
      <section id="projects" style={{ padding: '100px 24px', background: '#050506' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Upcoming Projects</div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: -2, lineHeight: 1.05 }}>
              What we're building<br />for you next.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {projects.map((proj, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                background: proj.gradient, border: `1px solid ${proj.accentColor}20`,
                borderRadius: 24, overflow: 'hidden',
                transition: 'transform 0.3s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                className="project-card-grid"
              >
                {/* Left */}
                <div style={{ padding: 48 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: proj.accentColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>{proj.tag}</div>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: proj.accentColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <i className={`fa-solid ${proj.icon}`} style={{ color: proj.accentColor, fontSize: 24 }} />
                  </div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, letterSpacing: -1, marginBottom: 8 }}>{proj.title}</h3>
                  <div style={{ fontSize: 16, color: proj.accentColor, fontWeight: 600, marginBottom: 20 }}>{proj.subtitle}</div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>{proj.desc}</p>
                  <button style={{ background: proj.accentColor, color: '#000', border: 'none', borderRadius: 9999, fontWeight: 700, fontSize: 14, padding: '12px 24px', cursor: 'pointer' }}>
                    Learn more →
                  </button>
                </div>

                {/* Right — Feature List */}
                <div style={{ padding: 48, display: 'flex', alignItems: 'center', borderLeft: `1px solid ${proj.accentColor}15` }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 24 }}>Key features</div>
                    {proj.bullets.map((b, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: proj.accentColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <i className="fa-solid fa-check" style={{ color: proj.accentColor, fontSize: 10 }} />
                        </div>
                        <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA STRIP ── */}
      <section style={{ padding: '120px 24px', textAlign: 'center', background: '#000' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(40px, 6vw, 70px)', fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, marginBottom: 24 }}>
            Join the Aries<br />ecosystem today.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, marginBottom: 44, lineHeight: 1.6 }}>
            Connect your MetaMask, register your node, and start earning staking yields and matching rewards immediately.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleLaunchApp} disabled={loading} style={{
              background: '#fff', color: '#000',
              border: 'none', borderRadius: 9999,
              fontWeight: 800, fontSize: 18, padding: '18px 44px',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Get started free →'}
            </button>
          </div>
          <div style={{ marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            No account needed. Just a Web3 wallet.
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '48px 24px', background: '#000' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>
            Aries<span style={{ color: '#1970ff' }}>.</span>
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {['Terms', 'Privacy', 'Whitepaper', 'GitHub', 'Discord'].map(l => (
              <a key={l} href="#" style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = '#fff'}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
              >{l}</a>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Aries Protocol</div>
        </div>
      </footer>

      {/* ── KEYFRAME PULSE ── */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media(max-width:768px){
          .feature-tab-grid { grid-template-columns: 1fr !important; }
          .project-card-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── REGISTRATION MODAL ── */}
      {showRegModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
          <div style={{ background: '#0d0e12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, width: '100%', maxWidth: 440, padding: 40, position: 'relative', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
            <button onClick={() => setShowRegModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', fontSize: 16 }}>
              <i className="fa-solid fa-xmark" />
            </button>

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 900, letterSpacing: -0.5, marginBottom: 8 }}>Activate your node</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.6 }}>Complete your profile to join the Aries network and start earning staking rewards.</p>
            </div>

            {[
              { label: 'Full Name', placeholder: 'e.g. John Doe', value: name, set: setName, type: 'text' },
              { label: 'Mobile Number', placeholder: 'e.g. +1 (555) 123-4567', value: mobile, set: setMobile, type: 'tel' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={f.value} onChange={e => f.set(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 15, padding: '13px 16px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.border = '1px solid rgba(25,112,255,0.6)'}
                  onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.1)'}
                />
              </div>
            ))}

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Referrer Address</label>
              <input type="text" value={referrer} onChange={e => setReferrer(e.target.value)} readOnly={referrerFrozen} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: 'rgba(255,255,255,0.5)', fontSize: 12, padding: '13px 16px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box', opacity: 0.75 }} />
            </div>

            <button onClick={handleRegister} disabled={regLoading} style={{ width: '100%', background: '#1970ff', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, padding: '15px', cursor: 'pointer', transition: 'all 0.2s', opacity: regLoading ? 0.7 : 1 }}>
              {regLoading ? <><i className="fa-solid fa-spinner fa-spin" /> &nbsp;Registering...</> : 'Complete Registration'}
            </button>
          </div>
        </div>
      )}
      {/* Wallet Connect Modal */}
      <WalletConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={connectToWallet}
        isConnecting={connectingWalletId !== null}
        connectingWalletId={connectingWalletId}
      />
    </div>
  );
}
