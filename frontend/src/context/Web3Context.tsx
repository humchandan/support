'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

export interface Web3ContextType {
  userAddress: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  jwtToken: string | null;
  userProfile: any;
  loading: boolean;
  isConnected: boolean;
  isConnectModalOpen: boolean;
  setIsConnectModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  connectingWalletId: string | null;
  connectWallet: () => Promise<void>;
  connectToWallet: (walletId: string) => Promise<void>;
  disconnectWallet: () => void;
  registerUser: (name: string, mobile: string, referrerAddress: string) => Promise<{ success: boolean; error?: string }>;
  loadProfile: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

const ARIES_CHAIN_ID = '0x38be9'; // 232425

// Extend window interface for browser providers
declare global {
  interface Window {
    ethereum?: any;
    coinbaseWalletExtension?: any;
    phantom?: any;
    trustWallet?: any;
    okxwallet?: any;
  }
}

// Helper to get browser injected providers
const getWalletProvider = (walletId: string): any => {
  if (typeof window === 'undefined') return null;

  switch (walletId) {
    case 'metamask':
      if (window.ethereum) {
        if (window.ethereum.providers) {
          return window.ethereum.providers.find((p: any) => p.isMetaMask) || window.ethereum;
        }
        if (window.ethereum.isMetaMask) return window.ethereum;
      }
      break;
    case 'coinbase':
      if (window.coinbaseWalletExtension) return window.coinbaseWalletExtension;
      if (window.ethereum) {
        if (window.ethereum.providers) {
          return window.ethereum.providers.find((p: any) => p.isCoinbaseWallet || p.isCoinbase) || window.ethereum;
        }
        if (window.ethereum.isCoinbaseWallet || window.ethereum.isCoinbase) return window.ethereum;
      }
      break;
    case 'phantom':
      if (window.phantom?.ethereum) return window.phantom.ethereum;
      if (window.ethereum) {
        if (window.ethereum.providers) {
          return window.ethereum.providers.find((p: any) => p.isPhantom) || window.ethereum;
        }
        if (window.ethereum.isPhantom) return window.ethereum;
      }
      break;
    case 'trust':
      if (window.trustWallet) return window.trustWallet;
      if (window.ethereum) {
        if (window.ethereum.providers) {
          return window.ethereum.providers.find((p: any) => p.isTrust || p.isTrustWallet) || window.ethereum;
        }
        if (window.ethereum.isTrust || window.ethereum.isTrustWallet) return window.ethereum;
      }
      break;
    case 'okx':
      if (window.okxwallet) return window.okxwallet;
      if (window.ethereum) {
        if (window.ethereum.providers) {
          return window.ethereum.providers.find((p: any) => p.isOKX || p.isOKXHeaders) || window.ethereum;
        }
        if (window.ethereum.isOKX || window.ethereum.isOKXHeaders) return window.ethereum;
      }
      break;
    case 'brave':
      if (window.ethereum) {
        if (window.ethereum.providers) {
          return window.ethereum.providers.find((p: any) => p.isBraveWallet) || window.ethereum;
        }
        if (window.ethereum.isBraveWallet) return window.ethereum;
      }
      break;
    case 'injected':
    default:
      if (window.ethereum) {
        if (window.ethereum.providers && window.ethereum.providers.length > 0) {
          return window.ethereum.providers[0];
        }
        return window.ethereum;
      }
      break;
  }
  return null;
};

// Switch network to Aries Network
const switchOrAddNetwork = async (rawProvider: any): Promise<void> => {
  if (!rawProvider) return;
  const ariesChainConfig = {
    chainId: ARIES_CHAIN_ID,
    chainName: 'Aries Network',
    nativeCurrency: {
      name: 'ARES',
      symbol: 'ARES',
      decimals: 18,
    },
    rpcUrls: [process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'http://127.0.0.1:8545'],
    blockExplorerUrls: ['http://localhost'],
  };

  // Step 1: Try switching to the chain
  try {
    await rawProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARIES_CHAIN_ID }],
    });
    return; // Success — already added and switched
  } catch (switchError: any) {
    // If error is NOT "chain not added" (4902), log and continue anyway
    if (switchError.code !== 4902 && !switchError.message?.includes('Unrecognized chain ID')) {
      console.warn('wallet_switchEthereumChain failed, attempting wallet_addEthereumChain...', switchError.code);
    }
  }

  // Step 2: Try adding the chain (covers both "not added" and "needs re-add" cases)
  try {
    await rawProvider.request({
      method: 'wallet_addEthereumChain',
      params: [ariesChainConfig],
    });
  } catch (addError: any) {
    // Non-fatal: user may have already added the network manually or rejected the prompt
    console.warn('wallet_addEthereumChain failed (non-fatal, connection will proceed):', addError.code || addError.message || addError);
  }
};

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // JWT and Profile state
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Modal control
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);

  const activeRawProviderRef = useRef<any>(null);

  // ── Profile loader ───────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (token: string, addr: string) => {
    if (!token || !addr) return;
    try {
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUserProfile(data.registered ? data.user : null);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  // ── JWT auth flow (sign challenge) ───────────────────────────────────────────
  const runAuthFlow = useCallback(async (addr: string, ethSigner: ethers.Signer) => {
    try {
      const challengeRes = await fetch(`/api/auth/challenge?address=${addr}`);
      const { challenge, timestamp } = await challengeRes.json();

      const signature = await ethSigner.signMessage(challenge);

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature, challenge, timestamp }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        setJwtToken(verifyData.token);
        localStorage.setItem('jwt_token', verifyData.token);
        await loadProfile(verifyData.token, addr);
        return verifyData.token;
      } else {
        throw new Error(verifyData.error || 'Signature verification failed');
      }
    } catch (err) {
      console.error('Auth flow failed:', err);
      throw err;
    }
  }, [loadProfile]);

  // ── Disconnect Wallet ─────────────────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    // Unsubscribe listeners from the old raw provider
    if (activeRawProviderRef.current) {
      try {
        if (activeRawProviderRef.current.removeListener) {
          activeRawProviderRef.current.removeListener('accountsChanged', () => {});
          activeRawProviderRef.current.removeListener('chainChanged', () => {});
        }
      } catch (e) {
        console.error('Failed to unsubscribe wallet listeners:', e);
      }
    }

    activeRawProviderRef.current = null;
    setUserAddress(null);
    setProvider(null);
    setSigner(null);
    setIsConnected(false);
    setJwtToken(null);
    setUserProfile(null);

    localStorage.removeItem('wallet_type');
    localStorage.removeItem('jwt_token');
  }, []);

  // ── Connect To Specific Wallet ───────────────────────────────────────────────
  const connectToWallet = useCallback(async (walletId) => {
    setConnectingWalletId(walletId);
    try {
      const rawProvider = getWalletProvider(walletId);
      if (!rawProvider) {
        throw new Error(`Provider for ${walletId} not available.`);
      }

      // 1. Request account connection
      const accounts = await rawProvider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet.');
      }

      // 2. Ensure we are on the Aries Chain
      await switchOrAddNetwork(rawProvider);

      const addr = accounts[0].toLowerCase();
      const web3Provider = new ethers.BrowserProvider(rawProvider);
      const web3Signer = await web3Provider.getSigner();

      // Store references in state
      activeRawProviderRef.current = rawProvider;
      setProvider(web3Provider);
      setSigner(web3Signer);
      setUserAddress(addr);
      setIsConnected(true);

      // Save connected wallet preference
      localStorage.setItem('wallet_type', walletId);

      // 3. Complete JWT challenge flow
      await runAuthFlow(addr, web3Signer);

      // Close modal on success
      setIsConnectModalOpen(false);
    } catch (err) {
      console.error('Failed to connect to wallet:', err);
      alert(err.message || 'Connection failed.');
    } finally {
      setConnectingWalletId(null);
    }
  }, [runAuthFlow]);

  // Trigger modal display
  const connectWallet = useCallback(async () => {
    setIsConnectModalOpen(true);
  }, []);

  // ── Auto-restore session on page load ────────────────────────────────────────
  useEffect(() => {
    const initWeb3 = async () => {
      const savedWalletType = localStorage.getItem('wallet_type');
      const savedToken = localStorage.getItem('jwt_token');

      if (savedWalletType && savedToken) {
        const rawProvider = getWalletProvider(savedWalletType);
        if (rawProvider) {
          try {
            const accounts = await rawProvider.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              const addr = accounts[0].toLowerCase();
              const web3Provider = new ethers.BrowserProvider(rawProvider);
              const web3Signer = await web3Provider.getSigner();

              activeRawProviderRef.current = rawProvider;
              setProvider(web3Provider);
              setSigner(web3Signer);
              setUserAddress(addr);
              setIsConnected(true);
              setJwtToken(savedToken);

              await loadProfile(savedToken, addr);
            }
          } catch (err) {
            console.error('Failed to auto-restore session:', err);
          }
        }
      }
      setLoading(false);
    };

    initWeb3();
  }, [loadProfile]);

  // ── Setup Provider Event Listeners ──────────────────────────────────────────
  useEffect(() => {
    const rawProvider = activeRawProviderRef.current;
    if (!rawProvider) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
        return;
      }
      const newAddr = accounts[0].toLowerCase();
      setUserAddress(newAddr);

      // Regenerate signer & request signature challenge for new account
      try {
        const web3Provider = new ethers.BrowserProvider(rawProvider);
        const web3Signer = await web3Provider.getSigner();
        setProvider(web3Provider);
        setSigner(web3Signer);
        await runAuthFlow(newAddr, web3Signer);
      } catch (err) {
        console.error('Account switch authentication failed:', err);
        disconnectWallet();
      }
    };

    const handleChainChanged = async (chainId: string) => {
      // Prompt chain switch if chain becomes different from Aries
      if (chainId !== ARIES_CHAIN_ID && parseInt(chainId, 16) !== parseInt(ARIES_CHAIN_ID, 16)) {
        await switchOrAddNetwork(rawProvider);
      }
    };

    if (rawProvider.on) {
      rawProvider.on('accountsChanged', handleAccountsChanged);
      rawProvider.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (rawProvider.removeListener) {
        rawProvider.removeListener('accountsChanged', handleAccountsChanged);
        rawProvider.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected, userAddress, disconnectWallet, runAuthFlow]);

  // ── Register User ────────────────────────────────────────────────────────────
  const registerUser = async (name: string, mobile: string, referrerAddress: string): Promise<{ success: boolean; error?: string }> => {
    if (!jwtToken || !userAddress) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtToken}` },
        body: JSON.stringify({ name, mobile, referrerAddress }),
      });
      const data = await res.json();
      if (data.success) {
        await loadProfile(jwtToken, userAddress);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch {
      return { success: false, error: 'Connection failed' };
    }
  };

  return (
    <Web3Context.Provider
      value={{
        userAddress,
        provider,
        signer,
        jwtToken,
        userProfile,
        loading,
        isConnected,
        isConnectModalOpen,
        setIsConnectModalOpen,
        connectingWalletId,
        connectWallet,
        connectToWallet,
        disconnectWallet,
        registerUser,
        loadProfile: () => loadProfile(jwtToken || '', userAddress || ''),
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3(): Web3ContextType {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}
