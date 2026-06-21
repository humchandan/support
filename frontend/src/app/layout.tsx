import './globals.css';
import { Web3Providers } from '../lib/Web3Providers';
import { Web3Provider } from '../context/Web3Context';

export const metadata = {
  title: 'Aries Protocol — One Chain. Infinite Possibilities.',
  description: 'Aries is a next-generation blockchain for staking, NFT minting, creator payments, and utility bill settlements. Near-zero fees, sub-second finality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body>
        {/* Web3Providers = WagmiProvider + QueryClientProvider + RainbowKitProvider */}
        <Web3Providers>
          {/* Web3Provider = our JWT auth context on top of wagmi */}
          <Web3Provider>
            {children}
          </Web3Provider>
        </Web3Providers>
      </body>
    </html>
  );
}
