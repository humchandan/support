'use client';

import React, { useEffect } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { useRouter } from 'next/navigation';
import DashboardView from '../../components/DashboardView';

export default function AppRoute() {
  const { userAddress, userProfile, loading } = useWeb3();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!userAddress || !userProfile)) {
      router.push('/');
    }
  }, [userAddress, userProfile, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i>
          <span className="text-zinc-400 font-medium tracking-wide">Loading MLM Dashboard...</span>
        </div>
      </div>
    );
  }

  if (userAddress && userProfile) {
    return <DashboardView />;
  }

  return null;
}
