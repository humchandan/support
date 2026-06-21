'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';
import { waitForTransactionReceiptWithRetry } from '../lib/txWaiter';

const MLM_TIERS = [
  { name: "Default", minSelfInvestment: 100, minDirects: 0, minTeamVolume: 0, unlockedLevels: [1] },
  { name: "Bronze Leader", minSelfInvestment: 2000, minDirects: 2, minTeamVolume: 10000, unlockedLevels: [1, 2, 3] },
  { name: "Silver Leader", minSelfInvestment: 5000, minDirects: 4, minTeamVolume: 50000, unlockedLevels: [1, 2, 3, 4, 5] },
  { name: "Gold Leader", minSelfInvestment: 10000, minDirects: 6, minTeamVolume: 150000, unlockedLevels: [1, 2, 3, 4, 5, 6, 7] },
  { name: "Diamond Leader", minSelfInvestment: 25000, minDirects: 8, minTeamVolume: 500000, unlockedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: "Crown Leader", minSelfInvestment: 50000, minDirects: 10, minTeamVolume: 1000000, unlockedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
];

const MLM_LEVELS = [
  { level: 1, bonus: 8.0, requiredRank: "Default" },
  { level: 2, bonus: 4.0, requiredRank: "Bronze Leader" },
  { level: 3, bonus: 2.0, requiredRank: "Bronze Leader" },
  { level: 4, bonus: 1.5, requiredRank: "Silver Leader" },
  { level: 5, bonus: 1.0, requiredRank: "Silver Leader" },
  { level: 6, bonus: 1.0, requiredRank: "Gold Leader" },
  { level: 7, bonus: 0.75, requiredRank: "Gold Leader" },
  { level: 8, bonus: 0.75, requiredRank: "Diamond Leader" },
  { level: 9, bonus: 0.5, requiredRank: "Diamond Leader" },
  { level: 10, bonus: 0.5, requiredRank: "Crown Leader" }
];

const getFriendlyErrorMessage = (err) => {
  if (!err) return "Transaction failed.";
  
  const msg = (err.message || err.reason || "").toLowerCase();
  if (
    msg.includes("user rejected") || 
    msg.includes("user denied") || 
    err.code === "ACTION_REJECTED" || 
    err.code === 4001
  ) {
    return "Transaction was cancelled / rejected in wallet.";
  }

  // Handle gas estimation or call exceptions due to insufficient balance/gas
  if (
    msg.includes("estimategas") || 
    msg.includes("missing revert data") || 
    msg.includes("insufficient funds") ||
    err.code === "CALL_EXCEPTION"
  ) {
    return "Transaction failed during gas estimation. This usually happens if your wallet balance is insufficient to cover both the transaction cost (plan size/deposit) and network gas fees.";
  }

  const revertReasonRegex = /reverted with reason string '([^']+)'/i;
  const match = err.message?.match(revertReasonRegex);
  if (match && match[1]) {
    return `Blockchain Revert: ${match[1]}`;
  }

  if (msg.includes("execution reverted:")) {
    const parts = err.message.split("execution reverted:");
    if (parts[1]) {
      return `Blockchain Revert: ${parts[1].split("\n")[0].trim()}`;
    }
  }

  if (err.data) {
    return `Execution Error: ${err.data}`;
  }

  return err.reason || err.message || "Transaction failed.";
};

export default function WealthTab() {
  const { userAddress, jwtToken, userProfile, provider, signer, loadProfile } = useWeb3();

  // Active state / tabs
  const [mlmViewMode, setMlmViewMode] = useState('table'); // 'table' | 'tree'
  const [withdrawalType, setWithdrawalType] = useState('metamask'); // 'metamask' | 'utility'

  const [dbTiers, setDbTiers] = useState(MLM_TIERS);
  const [dbLevels, setDbLevels] = useState(MLM_LEVELS);

  const hasUnlockedLevel = (tier, levelNum) => {
    if (!tier || !tier.unlockedLevels) return false;
    if (Array.isArray(tier.unlockedLevels)) {
      return tier.unlockedLevels.includes(levelNum);
    }
    return levelNum <= Number(tier.unlockedLevels);
  };

  const getUnlockedLevelsCount = (tier) => {
    if (!tier || !tier.unlockedLevels) return 0;
    if (Array.isArray(tier.unlockedLevels)) {
      return tier.unlockedLevels.length;
    }
    return Number(tier.unlockedLevels) || 0;
  };

  useEffect(() => {
    const fetchConfig = async () => {
      if (!jwtToken) return;
      try {
        const res = await fetch('/api/admin/config', {
          headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.tiers && data.tiers.length > 0) {
            setDbTiers(data.tiers);
          }
          if (data.levels && data.levels.length > 0) {
            setDbLevels(data.levels);
          }
        }
      } catch (err) {
        console.error("Failed to fetch MLM configuration dynamically:", err);
      }
    };
    fetchConfig();
  }, [jwtToken]);

  const [purchaseAmount, setPurchaseAmount] = useState<string | number>('');
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [downlineSearch, setDownlineSearch] = useState('');
  const [simulationAddVal, setSimulationAddVal] = useState('');

  // Loading and alerts
  const [txLoading, setTxLoading] = useState(false);
  const [downlines, setDownlines] = useState([]);
  const [toast, setToast] = useState({ message: '', show: false, isError: false });

  // Accrued real-time rewards state
  const [accruedRewards, setAccruedRewards] = useState(0);

  // Inspector detailed profile modal
  const [inspectedPartner, setInspectedPartner] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Bottom Simulation / Projections Center Range controls
  const [simStaking, setSimStaking] = useState(100);
  const [simDirects, setSimDirects] = useState(0);
  const [simTeamVolume, setSimTeamVolume] = useState(0);
  const [simDownlineYield, setSimDownlineYield] = useState(0);

  // SVG downline tree pan/zoom state
  const [panX, setPanX] = useState(250);
  const [panY, setPanY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [isDraggingTree, setIsDraggingTree] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs
  const canvasRef = useRef(null);

  // Helper to trigger toast
  const showToast = (message, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Fetch downline list
  const loadDownlines = async () => {
    if (!jwtToken) return;
    try {
      const res = await fetch(`/api/user/downlines`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (data.downlines) {
        setDownlines(data.downlines);
      }
    } catch (err) {
      console.error("Failed to load downlines directory:", err);
    }
  };

  // 1. Live Yield Accumulation ticker effect (updates every 1 second)
  useEffect(() => {
    if (!userAddress || !userProfile) return;

    const selfInvestment = parseFloat(userProfile.selfInvestment) || 0;
    const baseYield = parseFloat(userProfile.yieldBalance) || 0;
    const lastAccruedStr = userProfile.lastYieldAccruedAt;

    // Set calculator default to user's real investment if available
    if (userProfile.selfInvestment) {
      setSimStaking(userProfile.selfInvestment);
    }

    if (selfInvestment <= 0) {
      setAccruedRewards(baseYield);
      return;
    }

    const lastAccruedTime = lastAccruedStr ? new Date(lastAccruedStr).getTime() : Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastAccruedTime) / 1000));
    const ratePerSec = (selfInvestment * 0.085) / 2592000.0;

    const totalClaimed = parseFloat(userProfile.totalClaimed) || 0;
    const maxLimit = selfInvestment * 2.5;

    let initialAccrued = baseYield + (elapsedSeconds * ratePerSec);
    if (totalClaimed + initialAccrued > maxLimit) {
      initialAccrued = maxLimit - totalClaimed;
    }

    setAccruedRewards(initialAccrued);

    const interval = setInterval(() => {
      setAccruedRewards(prev => {
        let nextVal = prev + ratePerSec;
        if (totalClaimed + nextVal > maxLimit) {
          nextVal = maxLimit - totalClaimed;
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [userAddress, userProfile]);

  useEffect(() => {
    loadDownlines();
  }, [jwtToken]);

  // Handle Buy Plan
  const handleBuyPlan = async () => {
    if (!signer) {
      showToast("Please connect your wallet first.", true);
      return;
    }
    const val = parseFloat(purchaseAmount.toString()) || 0;
    if (val < 100) {
      showToast("Minimum purchase plan size is 100 ARES.", true);
      return;
    }
    if (val % 100 !== 0) {
      showToast("Plan size must be in multiples of 100 ARES.", true);
      return;
    }

    try {
      setTxLoading(true);
      showToast("Confirm purchase transaction in MetaMask...", false);

      // Load portal address/abi
      const res = await fetch("/contracts/AriesSupportPortal.json");
      const supportData = await res.json();
      const portalContract = new ethers.Contract(supportData.address, supportData.abi, signer);

      const valueWei = ethers.parseEther(val.toString());
      const tx = await portalContract.purchasePlan({ 
        value: valueWei,
        gasPrice: ethers.parseUnits("1.5", "gwei")
      });
      
      showToast("Transaction submitted, waiting for confirmation...", false);
      const receipt = await waitForTransactionReceiptWithRetry(signer.provider || provider, tx.hash);

      // Submit to backend to store in database
      showToast("Registering validation plan in database...", false);
      const dbRes = await fetch("/api/user/stake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          txHash: receipt.hash || tx.hash,
          amount: val.toString()
        })
      });
      const dbData = await dbRes.json();
      if (!dbRes.ok) {
        throw new Error(dbData.error || "Failed to register plan in database.");
      }

      showToast(`Successfully purchased plan of ${val.toLocaleString()} ARES!`, false);
      setPurchaseAmount('');
      setActivePreset(null);
      await loadProfile();
    } catch (err) {
      console.error("Purchase failed:", err);
      showToast(getFriendlyErrorMessage(err), true);
    } finally {
      setTxLoading(false);
    }
  };

  // Add Simulated Accrual (Dev simulator tool)
  const handleSimulateAccrual = () => {
    if (!userAddress) {
      showToast("Please connect your wallet first.", true);
      return;
    }
    const val = parseFloat(simulationAddVal) || 0;
    if (val <= 0) {
      showToast("Enter a positive ARES amount to simulate.", true);
      return;
    }

    setAccruedRewards(prev => {
      const nextVal = prev + val;
      localStorage.setItem(`accrued_rewards_${userAddress}`, nextVal.toString());
      return nextVal;
    });
    setSimulationAddVal('');
    showToast(`Simulated yield deposit of ${val.toFixed(2)} ARES accrued!`, false);
  };

  // Process claims (split MetaMask claim or direct off-chain Utility claim)
  const handleClaimRewards = async () => {
    if (!userAddress || !userProfile) {
      showToast("Please connect your wallet first.", true);
      return;
    }
    if (accruedRewards <= 0) {
      showToast("No accrued rewards available to claim.", true);
      return;
    }

    if (withdrawalType === 'metamask') {
      // MetaMask Split Claim on-chain flow
      if (accruedRewards < 100.0) {
        showToast("You must have at least 100 ARES accrued to withdraw to MetaMask.", true);
        return;
      }
      if (!userProfile.proxyAddress) {
        showToast("Please create a utility wallet address first in the Utility Portal tab.", true);
        return;
      }
      if (provider) {
        try {
          const code = await provider.getCode(userProfile.proxyAddress);
          if (code === '0x' || code === '0x00') {
            showToast("Your utility wallet contract is not deployed on-chain. Please go to the Utility Portal tab and deploy/create it first.", true);
            return;
          }
        } catch (codeErr) {
          console.error("Failed to verify proxy wallet deployment:", codeErr);
        }
      }

      try {
        setTxLoading(true);
        showToast("Generating secure backend verification signature...", false);

        // Fetch signature from backend API
        const claimSignRes = await fetch('/api/ledger/claims/sign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify({ accruedAmount: accruedRewards })
        });
        const claimSignData = await claimSignRes.json();

        if (!claimSignRes.ok || !claimSignData.success) {
          throw new Error(claimSignData.error || "Failed to sign claim on server.");
        }

        const { signature, newTotalEligible, deadline, claimableAmount, portalAddress } = claimSignData;

        showToast("Submitting claim transaction to blockchain. Confirm in MetaMask...", false);

        // Submit claim to portal contract
        const portalJsonRes = await fetch("/contracts/AriesSupportPortal.json");
        const portalJson = await portalJsonRes.json();
        const portalContract = new ethers.Contract(portalAddress, portalJson.abi, signer);

        const tx = await portalContract.claimRewards(
          userProfile.proxyAddress,
          newTotalEligible,
          deadline,
          signature,
          { gasPrice: ethers.parseUnits("1.5", "gwei") }
        );
        const receipt = await waitForTransactionReceiptWithRetry(signer.provider || provider, tx.hash);

        // Submit to backend to record claim and distribute MLM matching rewards
        showToast("Registering claim in database...", false);
        const recordRes = await fetch("/api/ledger/claims/record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwtToken}`
          },
          body: JSON.stringify({
            txHash: receipt.hash || tx.hash,
            amount: claimableAmount.toString()
          })
        });
        const recordData = await recordRes.json();
        if (!recordRes.ok) {
          throw new Error(recordData.error || "Failed to register claim in database.");
        }

        // Update local rewards
        setAccruedRewards(prev => {
          const nextVal = Math.max(0.0, prev - claimableAmount);
          localStorage.setItem(`accrued_rewards_${userAddress}`, nextVal.toString());
          return nextVal;
        });

        showToast("Claim complete! Payout split 50/50 after 10% fee.", false);
        await loadProfile();
      } catch (err) {
        console.error("Claim failed:", err);
        showToast(getFriendlyErrorMessage(err), true);
      } finally {
        setTxLoading(false);
      }
    } else {
      // Direct Off-Chain Claim to Utility Balance flow
      try {
        setTxLoading(true);
        showToast("Submitting claim to utility portal database...", false);

        const claimRes = await fetch('/api/ledger/claims', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify({ amount: accruedRewards })
        });
        const claimData = await claimRes.json();

        if (!claimRes.ok) {
          throw new Error(claimData.error || "Utility claim API error.");
        }

        // Deduct claimed amount from local accrued rewards
        const claimed = claimData.claimedAmount / 0.9; // convert back to gross
        setAccruedRewards(prev => {
          const nextVal = Math.max(0.0, prev - claimed);
          localStorage.setItem(`accrued_rewards_${userAddress}`, nextVal.toString());
          return nextVal;
        });

        showToast(`Claim complete! ${claimData.claimedAmount.toFixed(2)} ARES credited to Utility Wallet.`, false);
        await loadProfile();
      } catch (err) {
        console.error("Claim failed:", err);
        showToast(err.message || "Utility claim failed.", true);
      } finally {
        setTxLoading(false);
      }
    }
  };

  // Helper to determine simulated rank
  const getSimRank = (investment, directs, volume) => {
    for (let i = dbTiers.length - 1; i >= 0; i--) {
      const tier = dbTiers[i];
      const minSelf = Number(tier.minSelfInvestment);
      const minTeam = Number(tier.minTeamVolume);
      if (
        investment >= minSelf &&
        directs >= tier.minDirects &&
        volume >= minTeam
      ) {
        return tier;
      }
    }
    return dbTiers[0];
  };

  // Draw simulation center canvas projection chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Grid lines (vertical months)
    ctx.strokeStyle = '#1a1c24';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#858e99';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 4; i++) {
      const x = paddingLeft + (chartWidth * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, paddingTop + chartHeight);
      ctx.stroke();
      ctx.fillText("M" + (i * 3), x, paddingTop + chartHeight + 14);
    }

    // Calculations
    const monthlyYield = simStaking * 0.085;
    const simRank = getSimRank(simStaking, simDirects, simTeamVolume);
    let matchingPct = 0;
    dbLevels.forEach(lvl => {
      if (hasUnlockedLevel(simRank, lvl.level)) {
        matchingPct += Number(lvl.bonus);
      }
    });
    const monthlyMatching = simDownlineYield * (matchingPct / 100.0);
    const monthlyTotal = monthlyYield + monthlyMatching;
    const maxCap = simStaking * 2.5;

    const total12 = monthlyTotal * 12;
    const maxY = Math.max(maxCap, total12, 1000) * 1.1;

    const getXPixel = (m) => paddingLeft + (chartWidth * m) / 12;
    const getYPixel = (v) => paddingTop + chartHeight - (chartHeight * v) / maxY;

    // Y-axis grid lines & labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '9px monospace';
    for (let i = 0; i <= 3; i++) {
      const val = (maxY * i) / 3;
      const y = getYPixel(val);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(paddingLeft + chartWidth, y);
      ctx.stroke();
      ctx.fillText(Math.round(val).toLocaleString(), paddingLeft - 8, y);
    }

    // Draw Cap limit line
    if (maxCap > 0) {
      const capY = getYPixel(maxCap);
      ctx.strokeStyle = '#ff453a';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, capY);
      ctx.lineTo(paddingLeft + chartWidth, capY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ff453a';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Cap: ${Math.round(maxCap).toLocaleString()}`, paddingLeft + 5, capY - 6);
    }

    // Draw Cumulative Earnings line
    if (monthlyTotal > 0) {
      const grad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
      grad.addColorStop(0, 'rgba(25, 112, 255, 0.25)');
      grad.addColorStop(1, 'rgba(25, 112, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(getXPixel(0), getYPixel(0));
      for (let m = 1; m <= 12; m++) {
        const e = Math.min(maxY, m * monthlyTotal);
        ctx.lineTo(getXPixel(m), getYPixel(e));
      }
      ctx.lineTo(getXPixel(12), getYPixel(0));
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#1970ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(getXPixel(0), getYPixel(0));
      for (let m = 1; m <= 12; m++) {
        const e = m * monthlyTotal;
        ctx.lineTo(getXPixel(m), getYPixel(Math.min(maxY, e)));
      }
      ctx.stroke();

      // Crossing point
      if (maxCap > 0 && total12 >= maxCap) {
        const crossMonth = maxCap / monthlyTotal;
        const crossX = getXPixel(crossMonth);
        const crossY = getYPixel(maxCap);

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(crossX, crossY, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(crossX, crossY);
        ctx.lineTo(crossX, paddingTop + chartHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Cap Hit: M${crossMonth.toFixed(1)}`, crossX, paddingTop + chartHeight - 10);
      }
    }
  }, [simStaking, simDirects, simTeamVolume, simDownlineYield]);

  // SVG downline tree pan & zoom mouse helpers
  const handleTreeMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDraggingTree(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleTreeMouseMove = (e) => {
    if (!isDraggingTree) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleTreeMouseUp = () => {
    setIsDraggingTree(false);
  };

  const handleTreeWheel = (e) => {
    e.preventDefault();
    const zoomIntensity = 0.05;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const wheelVal = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(wheelVal * zoomIntensity);

    setPanX(prev => mouseX - (mouseX - prev) * zoomFactor);
    setPanY(prev => mouseY - (mouseY - prev) * zoomFactor);
    setZoom(prev => Math.min(2.5, Math.max(0.4, prev * zoomFactor)));
  };

  // Inspect partner detail popup modal
  const handleInspectPartner = (partnerAddr) => {
    const partner = downlines.find(d => d.walletAddress.toLowerCase() === partnerAddr.toLowerCase());
    if (partner) {
      setInspectedPartner(partner);
      setShowModal(true);
    }
  };

  // Filter partners list
  const filteredDownlines = downlines.filter(d => {
    const search = downlineSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(search) ||
      d.mobile.toLowerCase().includes(search) ||
      d.walletAddress.toLowerCase().includes(search)
    );
  });

  // Calculate live capping ratios
  const realSelfInvestment = userProfile?.selfInvestment || 0;
  const realTotalClaimed = userProfile?.totalClaimed || 0;
  const realMaxLimit = realSelfInvestment * 2.5;
  const realRemainingCap = Math.max(0, realMaxLimit - realTotalClaimed);
  const realFillPct = realMaxLimit > 0 ? Math.min(100, (realTotalClaimed / realMaxLimit) * 100) : 0;

  // Active rank & unlocks
  const realDirects = userProfile?.directs || 0;
  const realTeamVolume = userProfile?.teamVolume || 0;
  const realRank = getSimRank(realSelfInvestment, realDirects, realTeamVolume);

  // Projections Center calculations
  const simRank = getSimRank(simStaking, simDirects, simTeamVolume);
  let simMatchingPct = 0;
  dbLevels.forEach(lvl => {
    if (hasUnlockedLevel(simRank, lvl.level)) {
      simMatchingPct += Number(lvl.bonus);
    }
  });
  const simMonthlyYield = simStaking * 0.085;
  const simMonthlyMatching = simDownlineYield * (simMatchingPct / 100.0);
  const simMonthlyTotal = simMonthlyYield + simMonthlyMatching;
  const simMaxCap = simStaking * 2.5;
  const simMonthsToCap = simMonthlyTotal > 0 ? (simMaxCap / simMonthlyTotal) : Infinity;

  // Estimated distribution calculator
  const eligibleToClaim = Math.min(accruedRewards, realRemainingCap);
  const adminFee = eligibleToClaim * 0.10;
  const netClaimed = eligibleToClaim - adminFee;
  const metamaskShare = netClaimed * 0.50;
  const utilityShare = netClaimed - metamaskShare;

  return (
    <div id="tab-wealth" className="space-y-6">

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-6">

          {/* Buy Validation Plan */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 relative overflow-hidden hover:border-zinc-700/50 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Investment</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Buy Validation Plan</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Deposit native ARES to buy a support plan. Earn 8.5% monthly yield and unlock MLM matching commissions.</p>

            {/* Preset buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[1000, 5000, 10000].map(preset => (
                <button
                  key={preset}
                  onClick={() => { setPurchaseAmount(preset); setActivePreset(preset); }}
                  className={`py-3 rounded-xl text-sm font-bold border transition-all duration-200 ${
                    activePreset === preset
                      ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                      : 'bg-zinc-950/60 text-zinc-300 border-zinc-800/60 hover:bg-zinc-800/60 hover:text-white hover:border-zinc-700/60'
                  }`}
                >
                  {preset.toLocaleString()} ARES
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Or Enter Custom Amount</label>
              <div className="relative">
                <input
                  type="number"
                  id="purchase-amount"
                  placeholder="Min 100 ARES"
                  min="100"
                  step="100"
                  value={purchaseAmount}
                  onChange={(e) => { setPurchaseAmount(e.target.value); setActivePreset(null); }}
                  className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3.5 pr-16 text-white text-sm focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/30 placeholder-zinc-600 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">ARES</span>
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">Must be 100 ARES or higher, in increments of 100.</p>
            </div>

            <button
              className="w-full py-3.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleBuyPlan}
              disabled={txLoading}
            >
              {txLoading ? <><i className="fa-solid fa-spinner fa-spin text-sm" /> Processing...</> : '⚡ Buy Validation Plan'}
            </button>
          </div>

          {/* Staking Investment History */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">History</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Staking Investment History</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Track all your active validation plan purchases with blockchain verified timestamps.</p>

            <div className="overflow-hidden rounded-xl border border-zinc-800/40">
              <div className="overflow-y-auto max-h-48">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-950/60 border-b border-zinc-800/40">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Date & Time</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Plan Size</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {!userProfile?.stakingPlans || userProfile.stakingPlans.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-zinc-600 text-sm">No plans purchased yet.</td>
                      </tr>
                    ) : (
                      userProfile.stakingPlans.map((plan, index) => {
                        const abbrHash = `${plan.txHash.substring(0, 6)}...${plan.txHash.substring(plan.txHash.length - 4)}`;
                        return (
                          <tr key={index} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-4 py-3 text-zinc-300 text-xs">{new Date(plan.timestamp).toLocaleString()}</td>
                            <td className="px-4 py-3 font-bold text-white text-xs">{plan.amount.toLocaleString()} ARES</td>
                            <td className="px-4 py-3">
                              <a
                                href={`http://localhost:9081/tx/${plan.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-cyan-400 hover:text-cyan-300 text-xs transition-colors"
                              >
                                {abbrHash}
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* MLM Organization & Unlocks */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Organization</div>
                <h2 className="text-xl font-bold text-white tracking-tight mb-1">MLM Organization & Unlocks</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">Track your team size, volume, and current leadership tier ranking.</p>
              </div>
              {/* View toggle */}
              <div className="flex gap-1 bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-1 flex-shrink-0">
                {['table', 'tree'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setMlmViewMode(mode); if (mode === 'tree') { setPanX(250); setPanY(50); setZoom(1); } }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 capitalize ${
                      mlmViewMode === mode ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Active Directs', value: realDirects },
                { label: 'Team Volume', value: `${realTeamVolume.toLocaleString()} ARES` },
                { label: 'Rank Achieved', value: userProfile?.rank || 'Default' },
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-950/60 rounded-xl p-4 border border-zinc-800/40">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mb-1.5">{stat.label}</div>
                  <div className="text-base font-black text-white leading-tight">{stat.value}</div>
                </div>
              ))}
            </div>

            {mlmViewMode === 'table' ? (
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Matching Bonus Tiers — 10 Levels</div>
                <div className="overflow-hidden rounded-xl border border-zinc-800/40">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-950/60 border-b border-zinc-800/40">
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Level</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Bonus</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Required Rank</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/30">
                      {dbLevels.map((lvl, idx) => {
                        const isUnlocked = hasUnlockedLevel(realRank, lvl.level);
                        return (
                          <tr key={idx} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-4 py-3 font-bold text-white text-xs">Level {lvl.level}</td>
                            <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{Number(lvl.bonus).toFixed(2)}%</td>
                            <td className="px-4 py-3 text-zinc-400 text-xs">{lvl.requiredRank}</td>
                            <td className="px-4 py-3">
                              {isUnlocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                  <i className="fa-solid fa-lock-open text-[9px]" /> Unlocked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-800/40 px-2 py-0.5 rounded-full">
                                  <i className="fa-solid fa-lock text-[9px]" /> Locked
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Interactive Downline Tree</div>
                <div
                  className="w-full h-[350px] bg-zinc-950/60 border border-zinc-800/40 rounded-xl relative overflow-hidden"
                  style={{ cursor: isDraggingTree ? 'grabbing' : 'grab' }}
                >
                  <svg
                    id="mlm-tree-svg"
                    style={{ width: '100%', height: '100%', userSelect: 'none' }}
                    onMouseDown={handleTreeMouseDown}
                    onMouseMove={handleTreeMouseMove}
                    onMouseUp={handleTreeMouseUp}
                    onMouseLeave={handleTreeMouseUp}
                    onWheel={handleTreeWheel}
                  >
                    <defs>
                      <linearGradient id="rootGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#e4e4e7" />
                      </linearGradient>
                      <linearGradient id="childGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#09090b" />
                        <stop offset="100%" stopColor="#18181b" />
                      </linearGradient>
                      <filter id="shadow" x="-10%" y="-10%" width="125%" height="125%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
                      </filter>
                    </defs>
                    <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                      {/* Root Card (YOU) */}
                      <g className="tree-node" transform="translate(-60, -25)">
                        <rect width="120" height="50" rx="8" fill="url(#rootGrad)" filter="url(#shadow)" stroke="#ffffff" strokeWidth="1.5" />
                        <text x="60" y="22" textAnchor="middle" fill="#000000" fontSize="10" fontWeight="bold" fontFamily="sans-serif">YOU (Primary)</text>
                        <text x="60" y="38" textAnchor="middle" fill="#71717a" fontSize="8" fontFamily="monospace">{realSelfInvestment.toLocaleString()} ARES</text>
                      </g>

                      {realDirects === 0 ? (
                        <>
                          <line x1="0" y1="25" x2="0" y2="100" stroke="#1a1c24" strokeWidth="1.5" strokeDasharray="3,3" />
                          <g transform="translate(-90, 100)">
                            <rect width="180" height="40" rx="8" fill="#111218" stroke="#1a1c24" strokeWidth="1" />
                            <text x="90" y="24" textAnchor="middle" fill="#858e99" fontSize="10" fontFamily="sans-serif">No directs sponsored yet</text>
                          </g>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const childY = 150;
                            const spacing = 150;
                            const startX = -((realDirects - 1) * spacing) / 2;
                            const nodes = [];

                            for (let i = 0; i < realDirects; i++) {
                              const childX = startX + i * spacing;
                              const partner = downlines[i];
                              const partnerName = partner ? partner.name : `Direct Recruit #${i + 1}`;
                              const partnerAddr = partner ? partner.walletAddress : '';

                              nodes.push(
                                <g key={i}>
                                  <path d={`M 0 25 L ${childX} ${childY - 25}`} stroke="#27272a" strokeWidth="1" fill="none" opacity="0.8" />
                                  <g
                                    className="tree-node"
                                    transform={`translate(${childX - 60}, ${childY - 25})`}
                                    style={{ cursor: partner ? 'pointer' : 'default' }}
                                    onClick={() => partner && handleInspectPartner(partnerAddr)}
                                  >
                                    <rect width="120" height="50" rx="8" fill="url(#childGrad)" filter="url(#shadow)" stroke="#27272a" strokeWidth="1" />
                                    <text x="60" y="22" textAnchor="middle" fill="#fafafa" fontSize="9" fontWeight="bold" fontFamily="sans-serif">{partnerName}</text>
                                    <text x="60" y="38" textAnchor="middle" fill="#10b981" fontSize="8" fontFamily="monospace">Active Plan</text>
                                  </g>
                                </g>
                              );
                            }

                            if (realDirects > 0) {
                              const child1X = startX;
                              if (hasUnlockedLevel(realRank, 2)) {
                                const level2Y = 250;
                                nodes.push(
                                  <g key="lvl2">
                                    <path d={`M ${child1X} ${childY + 25} L ${child1X} ${level2Y - 25}`} stroke="#00d27a" strokeWidth="1.5" fill="none" />
                                    <g className="tree-node" transform={`translate(${child1X - 60}, ${level2Y - 25})`}>
                                      <rect width="120" height="50" rx="8" fill="url(#childGrad)" filter="url(#shadow)" stroke="#00d27a" strokeWidth="1.5" />
                                      <text x="60" y="22" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">Level 2 Downline</text>
                                      <text x="60" y="38" textAnchor="middle" fill="#00d27a" fontSize="9" fontFamily="sans-serif">Unlocked (Bronze)</text>
                                    </g>
                                  </g>
                                );
                                if (hasUnlockedLevel(realRank, 4)) {
                                  const level3Y = 350;
                                  nodes.push(
                                    <g key="lvl4">
                                      <path d={`M ${child1X} ${level2Y + 25} L ${child1X} ${level3Y - 25}`} stroke="#1970ff" strokeWidth="1.5" fill="none" />
                                      <g className="tree-node" transform={`translate(${child1X - 60}, ${level3Y - 25})`}>
                                        <rect width="120" height="50" rx="8" fill="url(#childGrad)" filter="url(#shadow)" stroke="#1970ff" strokeWidth="1.5" />
                                        <text x="60" y="22" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">Level 4 Downline</text>
                                        <text x="60" y="38" textAnchor="middle" fill="#1970ff" fontSize="9" fontFamily="sans-serif">Unlocked (Silver)</text>
                                      </g>
                                    </g>
                                  );
                                } else {
                                  const level3Y = 350;
                                  nodes.push(
                                    <g key="lvl4-locked" opacity="0.5">
                                      <path d={`M ${child1X} ${level2Y + 25} L ${child1X} ${level3Y - 25}`} stroke="#1a1c24" strokeWidth="1.5" strokeDasharray="3,3" fill="none" />
                                      <g className="tree-node" transform={`translate(${child1X - 60}, ${level3Y - 25})`}>
                                        <rect width="120" height="50" rx="8" fill="#111218" stroke="#1a1c24" strokeWidth="1" />
                                        <text x="60" y="22" textAnchor="middle" fill="#858e99" fontSize="10" fontFamily="sans-serif">Level 4 Downline</text>
                                        <text x="60" y="38" textAnchor="middle" fill="#ff453a" fontSize="9" fontFamily="sans-serif">Locked (Silver)</text>
                                      </g>
                                    </g>
                                  );
                                }
                              } else {
                                const level2Y = 250;
                                nodes.push(
                                  <g key="lvl2-locked" opacity="0.5">
                                    <path d={`M ${child1X} ${childY + 25} L ${child1X} ${level2Y - 25}`} stroke="#1a1c24" strokeWidth="1.5" strokeDasharray="3,3" fill="none" />
                                    <g className="tree-node" transform={`translate(${child1X - 60}, ${level2Y - 25})`}>
                                      <rect width="120" height="50" rx="8" fill="#111218" stroke="#1a1c24" strokeWidth="1" />
                                      <text x="60" y="22" textAnchor="middle" fill="#858e99" fontSize="10" fontFamily="sans-serif">Level 2 Downline</text>
                                      <text x="60" y="38" textAnchor="middle" fill="#ff453a" fontSize="9" fontFamily="sans-serif">Locked (Bronze)</text>
                                    </g>
                                  </g>
                                );
                              }
                            }
                            return nodes;
                          })()}
                        </>
                      )}
                    </g>
                  </svg>
                  <div className="absolute bottom-3 right-3 text-[10px] text-zinc-600 bg-black/60 px-2 py-1 rounded-lg backdrop-blur-sm">
                    Drag to pan • Scroll to zoom
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Referral Center */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Referrals</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Referral Center & Downlines Directory</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Share your personal referral link to invite partners and earn 10 levels of matching yield commissions.</p>

            {/* Referral link */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Your Personal Referral Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={userAddress ? `${window.location.origin}?ref=${userAddress}` : 'Please connect wallet'}
                  className="flex-1 min-w-0 bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-zinc-400 text-xs font-mono focus:outline-none"
                />
                <button
                  title="Copy referral link"
                  onClick={() => {
                    if (userAddress) {
                      navigator.clipboard.writeText(`${window.location.origin}?ref=${userAddress}`);
                      showToast('Referral link copied to clipboard!', false);
                    }
                  }}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/60 rounded-xl text-zinc-300 hover:text-white transition-all text-sm"
                >
                  <i className="fa-solid fa-copy text-xs" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Sponsored Partners</div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, mobile, or address..."
                value={downlineSearch}
                onChange={(e) => setDownlineSearch(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 placeholder-zinc-600 transition-all"
              />
            </div>

            {/* Partners table */}
            <div className="overflow-hidden rounded-xl border border-zinc-800/40">
              <div className="overflow-y-auto max-h-60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-950/60 border-b border-zinc-800/40">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Name / Mobile</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide hidden sm:table-cell">Wallet</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Self Staking</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Team Vol.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {filteredDownlines.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 text-sm">No matching partners found.</td>
                      </tr>
                    ) : (
                      filteredDownlines.map((d, index) => {
                        const abbr = `${d.walletAddress.substring(0, 6)}...${d.walletAddress.substring(d.walletAddress.length - 4)}`;
                        return (
                          <tr
                            key={index}
                            className="hover:bg-zinc-800/20 transition-colors cursor-pointer"
                            onClick={() => handleInspectPartner(d.walletAddress)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white text-xs leading-tight">{d.name}</div>
                              <div className="text-[10px] text-zinc-500 mt-0.5">{d.mobile}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-zinc-400 text-xs hidden sm:table-cell">{abbr}</td>
                            <td className="px-4 py-3 font-bold text-white text-xs">{d.selfInvestment.toLocaleString()} ARES</td>
                            <td className="px-4 py-3 text-zinc-400 text-xs hidden md:table-cell">{d.teamVolume.toLocaleString()}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-6">

          {/* Payout Limit Status */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Payout Cap</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Payout Limit Status</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">All yields and MLM matching commissions count towards your hard 250% payout limit.</p>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-zinc-500 font-medium">Total Claimed</span>
                <span className="text-xs font-bold text-white font-mono">
                  {realTotalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {realMaxLimit.toLocaleString()} ARES
                </span>
              </div>
              <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    realFillPct >= 100 ? 'bg-red-500' : realFillPct > 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ width: `${realFillPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-[10px] text-zinc-600">{realFillPct.toFixed(1)}% used</span>
                <span className="text-[10px] text-zinc-600">{(100 - realFillPct).toFixed(1)}% remaining</span>
              </div>

              {realFillPct >= 100 && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-red-950/40 border border-red-900/40 rounded-xl text-xs text-red-400">
                  <i className="fa-solid fa-triangle-exclamation flex-shrink-0" />
                  <span>Limit reached! Please purchase a top-up plan to continue withdrawals.</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-2.5">
              {[
                { label: 'Active Plans Purchase', value: `${realSelfInvestment.toLocaleString()} ARES`, color: '' },
                { label: 'Maximum Payout (2.5x)', value: `${realMaxLimit.toLocaleString()} ARES`, color: '' },
                { label: 'Withdrawn Balance', value: `${realTotalClaimed.toLocaleString()} ARES`, color: 'text-emerald-400' },
                { label: 'Remaining Cap Capacity', value: `${realRemainingCap.toLocaleString()} ARES`, color: 'text-cyan-400' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/30 last:border-0">
                  <span className="text-xs text-zinc-500">{row.label}</span>
                  <span className={`text-xs font-bold ${row.color || 'text-white'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Withdrawal Center */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Withdrawals</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Withdrawal Center</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              {withdrawalType === 'metamask'
                ? 'Claims split 50/50: 50% to MetaMask and 50% to your utility account (minus 10% admin fee).'
                : 'Claims go 100% directly to your off-chain Utility Portal account balance (minus 10% admin fee).'}
            </p>

            {/* Toggle */}
            <div className="flex gap-1 bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-1 mb-6">
              {[
                { key: 'metamask', label: 'MetaMask Split' },
                { key: 'utility', label: 'Utility Wallet' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setWithdrawalType(opt.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    withdrawalType === opt.key ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Accrued Ticker */}
            <div className="bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-5 mb-4 text-center">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Accrued Rewards (Yield + MLM)</div>
              <div className="text-3xl font-black text-white tracking-tight tabular-nums">
                {accruedRewards.toFixed(6)}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-1">ARES</div>
            </div>

            {/* Info banner */}
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border mb-5 text-xs ${
              withdrawalType === 'metamask'
                ? 'bg-cyan-950/30 border-cyan-900/40 text-cyan-400'
                : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400'
            }`}>
              <i className="fa-solid fa-circle-info flex-shrink-0 mt-0.5" />
              <span>
                {withdrawalType === 'metamask'
                  ? 'MetaMask Split requires a minimum of 100 ARES accrued. Payout splits 50/50 net of a 10% fee.'
                  : 'Utility Wallet Direct allows instant claim of any amount, limited to 4 claims per month.'}
              </span>
            </div>

            {/* Estimated distribution */}
            {accruedRewards > 0 && realSelfInvestment > 0 && (
              <div className="space-y-1.5 mb-5">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Estimated Distribution</div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Admin Fee (10%)</span>
                  <span className="font-mono text-red-400">-{adminFee.toFixed(6)} ARES</span>
                </div>
                {withdrawalType === 'metamask' ? (
                  <>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">→ MetaMask Wallet (50%)</span>
                      <span className="font-mono text-emerald-400">+{metamaskShare.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">→ Utility Wallet (50%)</span>
                      <span className="font-mono text-cyan-400">+{utilityShare.toFixed(6)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">→ Utility Wallet (100%)</span>
                    <span className="font-mono text-cyan-400">+{netClaimed.toFixed(6)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              className="w-full py-3.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleClaimRewards}
              disabled={txLoading}
            >
              {txLoading ? <><i className="fa-solid fa-spinner fa-spin" /> Processing...</> : withdrawalType === 'metamask' ? '💰 Claim Split Payout' : '🏦 Claim to Utility Wallet'}
            </button>
          </div>

        </div>
      </div>

      {/* ── PROJECTIONS CENTER (Full-width below) ── */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Simulator</div>
        <h2 className="text-xl font-bold text-white tracking-tight mb-1.5 flex items-center gap-2">
          <span className="text-cyan-400">⚗</span> Projections & Simulation Center
        </h2>
        <p className="text-sm text-zinc-400 mb-8 leading-relaxed">Simulate different staking amounts, direct sponsor size, and team business volume to see simulated rank, unlocked levels, and earnings cap crossover projections.</p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* Controls */}
          <div className="space-y-6">
            {[
              { label: 'Simulated Self-Staking', value: `${simStaking.toLocaleString()} ARES`, min: 100, max: 100000, step: 100, state: simStaking, setter: setSimStaking, marks: ['100', '25,000', '50,000', '100,000+'] },
              { label: 'Simulated Direct Recruits', value: `${simDirects} ${simDirects === 1 ? 'Partner' : 'Partners'}`, min: 0, max: 12, step: 1, state: simDirects, setter: setSimDirects, marks: ['0', '4', '8', '12+'] },
              { label: 'Simulated Team Volume', value: `${simTeamVolume.toLocaleString()} ARES`, min: 0, max: 1200000, step: 10000, state: simTeamVolume, setter: setSimTeamVolume, marks: ['0', '150,000', '500,000', '1M+'] },
              { label: 'Simulated Downline Monthly Yield', value: `${simDownlineYield.toLocaleString()} ARES`, min: 0, max: 100000, step: 1000, state: simDownlineYield, setter: setSimDownlineYield, marks: ['0', '25,000', '50,000', '100,000'] },
            ].map((slider, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-zinc-400">{slider.label}</label>
                  <span className="text-xs font-black text-cyan-400 font-mono">{slider.value}</span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={slider.state}
                  onChange={(e) => slider.setter(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  {slider.marks.map(m => <span key={m}>{m}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* Results */}
          <div className="space-y-5">
            {/* Sim stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Simulated Rank', value: simRank.name, color: 'text-cyan-400' },
                { label: 'Unlock Ratio', value: `${getUnlockedLevelsCount(simRank)} / 10`, color: 'text-emerald-400' },
                { label: 'Months to Cap', value: simMonthlyTotal > 0 ? `${simMonthsToCap.toFixed(1)}mo` : '∞', color: 'text-amber-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-950/60 rounded-xl p-4 border border-zinc-800/40 text-center">
                  <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wide mb-1.5">{stat.label}</div>
                  <div className={`text-base font-black ${stat.color} leading-tight`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Monthly breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Monthly Yield', value: `${simMonthlyYield.toFixed(2)}`, color: 'text-white' },
                { label: 'Monthly Matching', value: `${simMonthlyMatching.toFixed(2)}`, color: 'text-white' },
                { label: '2.5x Cap Limit', value: `${simMaxCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'text-red-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-950/60 rounded-xl p-4 border border-zinc-800/40">
                  <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wide mb-1.5">{stat.label}</div>
                  <div className={`text-sm font-black ${stat.color} font-mono`}>{stat.value}</div>
                  <div className="text-[9px] text-zinc-600 mt-0.5">ARES</div>
                </div>
              ))}
            </div>

            {/* Canvas projection */}
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">12-Month Accumulation Projection</div>
              <div className="w-full h-[180px] bg-zinc-950/60 border border-zinc-800/40 rounded-xl overflow-hidden">
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── PARTNER INSPECTOR MODAL ── */}
      {showModal && inspectedPartner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6 md:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Partner Profile</h3>
              <button
                className="w-8 h-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all text-sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: '👤 Full Name', value: inspectedPartner.name, full: false },
                { label: '📱 Mobile Number', value: inspectedPartner.mobile, full: false },
                { label: '🔑 Wallet Address', value: inspectedPartner.walletAddress, full: true, mono: true },
                { label: '💰 Self Staking', value: `${inspectedPartner.selfInvestment.toLocaleString()} ARES`, full: false, color: 'text-emerald-400' },
                { label: '🌐 Team Volume', value: `${inspectedPartner.teamVolume.toLocaleString()} ARES`, full: false, color: 'text-cyan-400' },
                { label: '👥 Direct Recruits', value: inspectedPartner.directs, full: false },
              ].map((field, i) => (
                <div key={i} className={`${field.full ? 'col-span-2' : ''}`}>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide mb-1">{field.label}</div>
                  <div className={`text-sm font-bold ${field.color || 'text-white'} ${field.mono ? 'font-mono bg-zinc-950/60 px-3 py-2 rounded-xl text-xs break-all' : ''}`}>
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl text-sm font-semibold transition-all ${
          toast.isError
            ? 'bg-red-950/90 border-red-800/60 text-red-200'
            : 'bg-emerald-950/90 border-emerald-800/60 text-emerald-200'
        }`}>
          <i className={`fa-solid ${toast.isError ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm`} />
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}

