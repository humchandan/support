// Wagmi v2 + RainbowKit config for Aries Local Chain
// No WalletConnect = No API key required
import { createConfig, http } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  coinbaseWallet,
  trustWallet,
  braveWallet,
  injectedWallet,
  phantomWallet,
  okxWallet,
} from '@rainbow-me/rainbowkit/wallets';

// ── Aries Local Chain Definition ──────────────────────────────────────────────
export const ariesChain = {
  id: 232425,
  name: 'Aries Network',
  nativeCurrency: { name: 'ARES', symbol: 'ARES', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'https://rpc.arieschain.org'] },
  },
  blockExplorers: {
    default: { name: 'Aries Explorer', url: 'https://scan.arieschain.org' },
  },
  testnet: false,
};

import { walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';

// ── Wallet Connectors ─────────────────────────────────────────────────────────
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular Wallets',
      wallets: [
        metaMaskWallet,
        trustWallet,
        walletConnectWallet,
        coinbaseWallet,
        phantomWallet,
        okxWallet,
      ],
    },
    {
      groupName: 'Other',
      wallets: [braveWallet, injectedWallet],
    },
  ],
  {
    appName: 'Aries Protocol',
    // Replace this with your actual WalletConnect project ID for production!
    // Get one for free at https://cloud.walletconnect.com
    projectId: '3c0a514d874a5ea79d86a42217e651ce',
  }
);

// ── Wagmi Config ──────────────────────────────────────────────────────────────
export const wagmiConfig = createConfig({
  chains: [ariesChain],
  connectors,
  transports: {
    [ariesChain.id]: http(
      process.env.NEXT_PUBLIC_ARIES_RPC_URL || 'https://rpc.arieschain.org'
    ),
  },
  ssr: true,
});
