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

// ── Wallet Connectors (No WalletConnect = No Reown API needed) ─────────────
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular Wallets',
      wallets: [
        metaMaskWallet,
        trustWallet,
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
    // Because we removed walletConnectWallet, this ID is never pinged to Reown APIs.
    projectId: 'aries_local_no_wc',
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
