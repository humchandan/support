'use client';

import React from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import RevolutLanding from '../components/RevolutLanding';

export default function Home() {
  const { loading } = useWeb3();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i>
          <span className="text-zinc-400 font-medium tracking-wide">Initializing Aries Portal...</span>
        </div>
      </div>
    );
  }

  return <RevolutLanding />;
}
