'use client';

import React, { useState } from 'react';

// Inline SVG Icons for wallets
const MetaMaskIcon = () => (
  <svg viewBox="0 0 32 32" width="28" height="28">
    <path fill="#e17726" d="M29.5 5.5l-3.3 8.3-4.4-4.8 7.7-3.5z"/>
    <path fill="#e27625" d="M2.5 5.5l3.3 8.3 4.4-4.8-7.7-3.5z"/>
    <path fill="#e47622" d="M24.7 21.3l-1.9 4.3 6.7-1.1-4.8-3.2z"/>
    <path fill="#e47622" d="M7.3 21.3l1.9 4.3-6.7-1.1 4.8-3.2z"/>
    <path fill="#d7c1b1" d="M21.8 9l-4.4 4.8 5.4 1 2.4-5.5z"/>
    <path fill="#d7c1b1" d="M10.2 9l4.4 4.8-5.4 1-2.4-5.5z"/>
    <path fill="#233447" d="M22.8 14.8l-5.4-1 1.7 4.9 3.7-3.9z"/>
    <path fill="#233447" d="M9.2 14.8l5.4-1-1.7 4.9-3.7-3.9z"/>
    <path fill="#e37526" d="M19.1 18.7l-3.1 3-3.1-3H7.8l5.9 7 4.6-7h.8z"/>
    <path fill="#f6851b" d="M21.8 9h-1.6L16 13.2 11.8 9H10.2l-1.2 5.8 4.7 1h4.6l4.7-1-1.2-5.8z"/>
  </svg>
);

const CoinbaseIcon = () => (
  <svg viewBox="0 0 32 32" width="28" height="28">
    <rect width="32" height="32" rx="16" fill="#0052FF"/>
    <rect x="8" y="8" width="16" height="16" rx="3.5" fill="#FFFFFF"/>
  </svg>
);

const PhantomIcon = () => (
  <svg viewBox="0 0 32 32" width="28" height="28">
    <rect width="32" height="32" rx="16" fill="#AB9FF2"/>
    <path d="M22.5 13.5c0-3.3-2.7-6-6-6s-6 2.7-6 6c0 .8.2 1.6.5 2.3-.9 1.1-1.5 2.5-1.5 4.2 0 2.2 1.8 4 4 4 .8 0 1.5-.2 2.1-.6.7.4 1.5.6 2.4.6 2.2 0 4-1.8 4-4 0-1.7-.6-3.1-1.5-4.2.3-.7.5-1.5.5-2.3zm-7.5-1.5c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm3.5 4.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z" fill="#FFFFFF"/>
  </svg>
);

const TrustWalletIcon = () => (
  <svg viewBox="0 0 32 32" width="28" height="28">
    <rect width="32" height="32" rx="16" fill="#0500FF"/>
    <path d="M16 6.5s-6.5 2.5-6.5 5.5v6.5c0 4.5 6.5 7 6.5 7s6.5-2.5 6.5-7V12c0-3-6.5-5.5-6.5-5.5z" fill="#FFFFFF"/>
  </svg>
);

const OKXIcon = () => (
  <svg viewBox="0 0 32 32" width="28" height="28">
    <rect width="32" height="32" rx="16" fill="#000000"/>
    <path d="M7 7h5v5H7V7zm6 0h6v6h-6V7zm7 0h5v5h-5V7zM7 13h5v6H7v-6zm6 0h6v6h-6v-6zm7 0h5v6h-5v-6zM7 20h5v5H7v-5zm6 0h6v5h-6v-5zm7 0h5v5h-5v-5z" fill="#FFFFFF"/>
  </svg>
);

const BraveIcon = () => (
  <svg viewBox="0 0 32 32" width="28" height="28">
    <rect width="32" height="32" rx="16" fill="#FF4500"/>
    <path d="M16 6.5l8.5 14-8.5 5-8.5-5z" fill="#FFFFFF"/>
  </svg>
);

const InjectedIcon = () => (
  <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="32" height="32" rx="16" fill="#2A2C35" stroke="none"/>
    <rect x="8" y="10" width="16" height="12" rx="2" stroke="#FFFFFF"/>
    <path d="M16 14h4v4h-4z" fill="#FFFFFF"/>
  </svg>
);

const walletsList = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: <MetaMaskIcon />,
    checkInstalled: () => typeof window !== 'undefined' && !!(window.ethereum?.isMetaMask || window.ethereum?.providers?.some(p => p.isMetaMask)),
    installUrl: 'https://metamask.io/download/'
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: <CoinbaseIcon />,
    checkInstalled: () => typeof window !== 'undefined' && !!(window.coinbaseWalletExtension || window.ethereum?.isCoinbaseWallet || window.ethereum?.isCoinbase || window.ethereum?.providers?.some(p => p.isCoinbaseWallet || p.isCoinbase)),
    installUrl: 'https://www.coinbase.com/wallet'
  },
  {
    id: 'phantom',
    name: 'Phantom',
    icon: <PhantomIcon />,
    checkInstalled: () => typeof window !== 'undefined' && !!(window.phantom?.ethereum || window.ethereum?.isPhantom || window.ethereum?.providers?.some(p => p.isPhantom)),
    installUrl: 'https://phantom.app/download'
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    icon: <TrustWalletIcon />,
    checkInstalled: () => typeof window !== 'undefined' && !!(window.trustWallet || window.ethereum?.isTrust || window.ethereum?.isTrustWallet || window.ethereum?.providers?.some(p => p.isTrust || p.isTrustWallet)),
    installUrl: 'https://trustwallet.com/download'
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: <OKXIcon />,
    checkInstalled: () => typeof window !== 'undefined' && !!(window.okxwallet || window.ethereum?.isOKX || window.ethereum?.isOKXHeaders || window.ethereum?.providers?.some(p => p.isOKX || p.isOKXHeaders)),
    installUrl: 'https://www.okx.com/web3'
  },
  {
    id: 'brave',
    name: 'Brave Wallet',
    icon: <BraveIcon />,
    checkInstalled: () => typeof window !== 'undefined' && !!(window.ethereum?.isBraveWallet || window.ethereum?.providers?.some(p => p.isBraveWallet)),
    installUrl: 'https://brave.com/wallet/'
  },
  {
    id: 'injected',
    name: 'Injected Wallet',
    icon: <InjectedIcon />,
    checkInstalled: () => typeof window !== 'undefined' && !!window.ethereum,
    installUrl: null
  }
];

export default function WalletConnectModal({ isOpen, onClose, onConnect, isConnecting, connectingWalletId }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [notInstalledWallet, setNotInstalledWallet] = useState(null);

  if (!isOpen) return null;

  const handleWalletSelect = (wallet) => {
    setErrorMsg('');
    setNotInstalledWallet(null);

    const isInstalled = wallet.checkInstalled();
    if (!isInstalled && wallet.installUrl) {
      setNotInstalledWallet(wallet);
      setErrorMsg(`${wallet.name} is not installed on this browser.`);
      return;
    }

    onConnect(wallet.id);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Close Button */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Connect a Wallet</h2>
          <p style={styles.subtitle}>Select your preferred wallet to log in to the Aries ecosystem.</p>
        </div>

        {/* Warning/Error Banner */}
        {errorMsg && (
          <div style={styles.errorBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444' }}></i>
              <span style={{ fontSize: 13, color: '#fca5a5' }}>{errorMsg}</span>
            </div>
            {notInstalledWallet?.installUrl && (
              <a 
                href={notInstalledWallet.installUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={styles.installLink}
              >
                Install {notInstalledWallet.name} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10 }}></i>
              </a>
            )}
          </div>
        )}

        {/* List of Wallets */}
        <div style={styles.walletsList}>
          {walletsList.map((wallet) => {
            const isSelfConnecting = isConnecting && connectingWalletId === wallet.id;
            return (
              <button
                key={wallet.id}
                onClick={() => handleWalletSelect(wallet)}
                disabled={isConnecting}
                style={{
                  ...styles.walletRow,
                  opacity: isConnecting && !isSelfConnecting ? 0.4 : 1,
                  cursor: isConnecting ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(25, 112, 255, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isConnecting) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  }
                }}
              >
                <div style={styles.walletInfo}>
                  <div style={styles.iconWrapper}>{wallet.icon}</div>
                  <span style={styles.walletName}>{wallet.name}</span>
                </div>

                {isSelfConnecting ? (
                  <div style={styles.spinner}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ color: '#1970ff' }}></i>
                  </div>
                ) : (
                  <div style={styles.arrowIcon}>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: 12 }}></i>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div style={styles.footer}>
          <span style={styles.footerText}>Secure, fee-less in-house connection portal.</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.82)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
  },
  container: {
    background: '#0a0a0d',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    padding: '36px 32px 28px 32px',
    position: 'relative',
    boxShadow: '0 40px 100px rgba(0, 0, 0, 0.7)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  },
  closeBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    background: 'rgba(255, 255, 255, 0.04)',
    border: 'none',
    borderRadius: '50%',
    width: 32,
    height: 32,
    color: '#a1a1aa',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    transition: 'all 0.2s',
  },
  header: {
    marginBottom: 24,
    textAlign: 'left',
  },
  title: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 24,
    fontWeight: 800,
    color: '#ffffff',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: 14,
    color: '#71717a',
    margin: 0,
    lineHeight: 1.5,
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.07)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  installLink: {
    fontSize: 12,
    color: '#60a5fa',
    textDecoration: 'none',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 26,
  },
  walletsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 380,
    overflowY: 'auto',
    paddingRight: 4,
  },
  walletRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    transition: 'all 0.2s ease',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  walletInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#e4e4e7',
  },
  arrowIcon: {
    color: '#52525b',
  },
  spinner: {
    display: 'flex',
    alignItems: 'center',
  },
  footer: {
    marginTop: 24,
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: 16,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#3f3f46',
    letterSpacing: 0.2,
  }
};
