import React from 'react';

interface YearParams {
  year: string;
}

export async function generateMetadata({ params }: { params: Promise<YearParams> }) {
  const { year } = await params;
  return {
    title: `Aries Promotions — Year ${year}`,
    description: `Explore all monthly promotions, staking boosters, and network incentives launched during the calendar year of ${year}.`,
  };
}

export default function YearLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
