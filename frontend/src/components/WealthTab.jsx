'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';

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

  // Input states
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [activePreset, setActivePreset] = useState(null);
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
    if (!userAddress) return;

    // Load initial accrued state
    const savedAccrued = localStorage.getItem(`accrued_rewards_${userAddress}`);
    const initialVal = savedAccrued ? parseFloat(savedAccrued) : 0;
    setAccruedRewards(initialVal);

    // Set calculator default to user's real investment if available
    if (userProfile && userProfile.selfInvestment) {
      setSimStaking(userProfile.selfInvestment);
    }
  }, [userAddress, userProfile]);

  useEffect(() => {
    if (!userAddress || !userProfile || !userProfile.selfInvestment) return;

    const interval = setInterval(() => {
      setAccruedRewards(prev => {
        const ratePerSec = (userProfile.selfInvestment * 0.0833) / 2592000.0;
        const nextVal = prev + ratePerSec;
        localStorage.setItem(`accrued_rewards_${userAddress}`, nextVal.toString());
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
    const val = parseFloat(purchaseAmount) || 0;
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
      const tx = await portalContract.purchasePlan({ value: valueWei });
      
      showToast("Transaction submitted, waiting for confirmation...", false);
      await tx.wait();

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
          signature
        );
        await tx.wait();

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
    const monthlyYield = simStaking * 0.0833;
    const simRank = getSimRank(simStaking, simDirects, simTeamVolume);
    let matchingPct = 0;
    dbLevels.forEach(lvl => {
      if (hasUnlockedLevel(simRank, lvl.level)) {
        matchingPct += Number(lvl.bonus);
      }
    });
    const monthlyMatching = simDownlineYield * (matchingPct / 100.0);
    const monthlyTotal = monthlyYield + monthlyMatching;
    const maxCap = simStaking * 2.0;

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
  const realMaxLimit = realSelfInvestment * 2;
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
  const simMonthlyYield = simStaking * 0.0833;
  const simMonthlyMatching = simDownlineYield * (simMatchingPct / 100.0);
  const simMonthlyTotal = simMonthlyYield + simMonthlyMatching;
  const simMaxCap = simStaking * 2.0;
  const simMonthsToCap = simMonthlyTotal > 0 ? (simMaxCap / simMonthlyTotal) : Infinity;

  // Estimated distribution calculator
  const eligibleToClaim = Math.min(accruedRewards, realRemainingCap);
  const adminFee = eligibleToClaim * 0.10;
  const netClaimed = eligibleToClaim - adminFee;
  const metamaskShare = netClaimed * 0.50;
  const utilityShare = netClaimed - metamaskShare;

  return (
    <div className="tab-content active" id="tab-wealth">
      <div className="grid-layout">
        
        {/* Left Column */}
        <div className="main-column">
          
          {/* Buy Validation Plan Card */}
          <div className="revolut-card">
            <h3 className="card-title">Buy Validation Plan</h3>
            <p className="card-desc">Deposit native ARES to buy a support plan. Earn yield and unlock MLM matching benefits.</p>
            
            <div className="preset-buttons">
              <button className={`btn-preset ${activePreset === 1000 ? 'active' : ''}`} onClick={() => { setPurchaseAmount(1000); setActivePreset(1000); }}>1,000 ARES</button>
              <button className={`btn-preset ${activePreset === 5000 ? 'active' : ''}`} onClick={() => { setPurchaseAmount(5000); setActivePreset(5000); }}>5,000 ARES</button>
              <button className={`btn-preset ${activePreset === 10000 ? 'active' : ''}`} onClick={() => { setPurchaseAmount(10000); setActivePreset(10000); }}>10,000 ARES</button>
            </div>

             <div className="form-group">
              <label htmlFor="purchase-amount">Or enter custom amount</label>
              <div className="input-container">
                <input 
                  type="number" 
                  id="purchase-amount" 
                  placeholder="Min 100 ARES" 
                  min="100" 
                  step="100"
                  value={purchaseAmount}
                  onChange={(e) => { setPurchaseAmount(e.target.value); setActivePreset(null); }}
                />
                <span className="input-suffix">ARES</span>
              </div>
              <small className="helper-text">Must be 100 ARES or higher, in increments of 100.</small>
            </div>

            <button className="btn-primary" onClick={handleBuyPlan} disabled={txLoading}>
              {txLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Buy Plan'}
            </button>
          </div>

          {/* Staking Investment History Card */}
          <div className="revolut-card">
            <h3 className="card-title">Staking Investment History</h3>
            <p className="card-desc">Track all your active validation plan purchases with blockchain verified timestamps.</p>
            
            <div className="mlm-table-wrapper" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="revolut-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Plan Size</th>
                    <th>Tx Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {!userProfile?.stakingPlans || userProfile.stakingPlans.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>No plans purchased yet.</td>
                    </tr>
                  ) : (
                    userProfile.stakingPlans.map((plan, index) => {
                      const abbrHash = `${plan.txHash.substring(0, 6)}...${plan.txHash.substring(plan.txHash.length - 4)}`;
                      return (
                        <tr key={index}>
                          <td>{new Date(plan.timestamp).toLocaleString()}</td>
                          <td><strong>{plan.amount.toLocaleString()} ARES</strong></td>
                          <td>
                            <a 
                              href={`http://localhost:9081/tx/${plan.txHash}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="monospace" 
                              style={{ color: 'var(--primary-color)', textDecoration: 'none' }}
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

          {/* MLM Org & Unlocks Card */}
          <div className="revolut-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 className="card-title" style={{ marginBottom: '0' }}>MLM Organization &amp; Unlocks</h3>
                <p className="card-desc" style={{ marginBottom: '0' }}>Track your team size, volume, and current leadership tier ranking.</p>
              </div>
              <div className="preset-buttons" style={{ display: 'flex', margin: '0', width: 'auto', gap: '4px', padding: '3px', background: '#16171e', borderRadius: '9999px' }}>
                <button 
                  className={`btn-preset ${mlmViewMode === 'table' ? 'active' : ''}`} 
                  onClick={() => setMlmViewMode('table')}
                  style={{ borderRadius: '9999px', padding: '0.4rem 1rem', border: 'none', fontSize: '0.75rem', background: 'none' }}
                >
                  Table View
                </button>
                <button 
                  className={`btn-preset ${mlmViewMode === 'tree' ? 'active' : ''}`} 
                  onClick={() => {
                    setMlmViewMode('tree');
                    setPanX(250);
                    setPanY(50);
                    setZoom(1);
                  }}
                  style={{ borderRadius: '9999px', padding: '0.4rem 1rem', border: 'none', fontSize: '0.75rem', background: 'none' }}
                >
                  Tree View
                </button>
              </div>
            </div>

            <div className="mlm-stats-row" style={{ marginTop: '1rem' }}>
              <div className="mlm-stat-box">
                <div className="mlm-stat-label">Active Directs</div>
                <div className="mlm-stat-val">{realDirects}</div>
              </div>
              <div className="mlm-stat-box">
                <div className="mlm-stat-label">Team Volume</div>
                <div className="mlm-stat-val">{realTeamVolume.toLocaleString()} ARES</div>
              </div>
              <div className="mlm-stat-box">
                <div className="mlm-stat-label">Rank Achieved</div>
                <div className="mlm-stat-val">{userProfile?.rank || 'Default'}</div>
              </div>
            </div>

            {mlmViewMode === 'table' ? (
              <div id="mlm-table-view-container">
                <h4 style={{ margin: '1.5rem 0 0.75rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Matching Bonus Tiers (10 Levels)</h4>
                <div className="mlm-table-wrapper">
                  <table className="revolut-table">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th>Bonus</th>
                        <th>Required Rank</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbLevels.map((lvl, idx) => {
                        const isUnlocked = hasUnlockedLevel(realRank, lvl.level);
                        return (
                          <tr key={idx}>
                            <td><strong>Level {lvl.level}</strong></td>
                            <td>{Number(lvl.bonus).toFixed(2)}%</td>
                            <td>{lvl.requiredRank}</td>
                            <td>
                              {isUnlocked ? (
                                <span style={{ color: 'var(--success-color)', fontWeight: '600' }}><i className="fa-solid fa-lock-open"></i> Unlocked</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}><i className="fa-solid fa-lock"></i> Locked</span>
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
              <div id="mlm-tree-view-container" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', textAlign: 'left' }}>Interactive Downline Tree</h4>
                <div 
                  className="tree-canvas-wrapper" 
                  style={{ width: '100%', height: '350px', background: '#0c0d12', border: '1px solid var(--card-border)', borderRadius: '12px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg 
                    id="mlm-tree-svg" 
                    style={{ width: '100%', height: '100%', cursor: isDraggingTree ? 'grabbing' : 'grab', userSelect: 'none' }}
                    onMouseDown={handleTreeMouseDown}
                    onMouseMove={handleTreeMouseMove}
                    onMouseUp={handleTreeMouseUp}
                    onMouseLeave={handleTreeMouseUp}
                    onWheel={handleTreeWheel}
                  >
                    <defs>
                      <linearGradient id="rootGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1970ff" />
                        <stop offset="100%" stopColor="#0052cc" />
                      </linearGradient>
                      <linearGradient id="childGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#111218" />
                        <stop offset="100%" stopColor="#1b1c24" />
                      </linearGradient>
                      <filter id="shadow" x="-10%" y="-10%" width="125%" height="125%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
                      </filter>
                    </defs>
                    <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                      
                      {/* Root Card (YOU) */}
                      <g className="tree-node" transform="translate(-60, -25)">
                        <rect width="120" height="50" rx="8" fill="url(#rootGrad)" filter="url(#shadow)" stroke="#1970ff" strokeWidth="1.5" />
                        <text x="60" y="22" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">YOU (Primary)</text>
                        <text x="60" y="38" textAnchor="middle" fill="#99ccff" fontSize="9" fontFamily="monospace">{realSelfInvestment.toLocaleString()} ARES</text>
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
                                  {/* Connector line */}
                                  <path d={`M 0 25 L ${childX} ${childY - 25}`} stroke="#1970ff" strokeWidth="1.5" fill="none" opacity="0.6" />
                                  
                                  {/* Node Card */}
                                  <g 
                                    className="tree-node" 
                                    transform={`translate(${childX - 60}, ${childY - 25})`}
                                    style={{ cursor: partner ? 'pointer' : 'default' }}
                                    onClick={() => partner && handleInspectPartner(partnerAddr)}
                                  >
                                    <rect width="120" height="50" rx="8" fill="url(#childGrad)" filter="url(#shadow)" stroke="#1a1c24" strokeWidth="1" />
                                    <text x="60" y="22" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif">{partnerName}</text>
                                    <text x="60" y="38" textAnchor="middle" fill="#00d27a" fontSize="8" fontFamily="monospace">Active Plan</text>
                                  </g>
                                </g>
                              );
                            }

                            // Show single branches representing depth unlocks if Level 2 and Level 4 unlocks exist
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
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.6)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    Drag to pan • Scroll to zoom • Click nodes to inspect
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Referral Center & Downlines Directory Card */}
          <div className="revolut-card">
            <h3 className="card-title">Referral Center &amp; Downlines Directory</h3>
            <p className="card-desc">Share your personal referral link to invite partners and earn 10 levels of matching yield commissions. Inspect downline investments and contact details.</p>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Your Personal Referral Link</label>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <input 
                  type="text" 
                  readOnly 
                  style={{ fontSize: '0.85rem', padding: '0.75rem', background: '#16171e', fontFamily: 'var(--font-mono)' }} 
                  value={userAddress ? `${window.location.origin}?ref=${userAddress}` : 'Please connect wallet'}
                />
                <button 
                  className="btn-secondary" 
                  style={{ flex: '0 0 44px', padding: '0' }} 
                  title="Copy referral link"
                  onClick={() => {
                    if (userAddress) {
                      navigator.clipboard.writeText(`${window.location.origin}?ref=${userAddress}`);
                      showToast("Referral link copied to clipboard!", false);
                    }
                  }}
                >
                  <i className="fa-solid fa-copy"></i>
                </button>
              </div>
            </div>

            <h4 style={{ margin: '1.5rem 0 0.75rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Sponsored Partners</h4>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <input 
                type="text" 
                placeholder="Search partners by name, mobile, or address..." 
                style={{ padding: '0.6rem 0.85rem', fontSize: '0.85rem', background: '#16171e' }}
                value={downlineSearch}
                onChange={(e) => setDownlineSearch(e.target.value)}
              />
            </div>

            <div className="mlm-table-wrapper" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table className="revolut-table">
                <thead>
                  <tr>
                    <th>Name / Mobile</th>
                    <th>Wallet Address</th>
                    <th>Self Staking</th>
                    <th>Team Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDownlines.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>No matching partners found.</td>
                    </tr>
                  ) : (
                    filteredDownlines.map((d, index) => {
                      const abbr = `${d.walletAddress.substring(0, 6)}...${d.walletAddress.substring(d.walletAddress.length - 4)}`;
                      return (
                        <tr key={index} style={{ cursor: 'pointer' }} onClick={() => handleInspectPartner(d.walletAddress)}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#ffffff' }}>{d.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.mobile}</div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} title={d.walletAddress}>{abbr}</td>
                          <td><strong>{d.selfInvestment.toLocaleString()} ARES</strong></td>
                          <td>{d.teamVolume.toLocaleString()} ARES</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="side-column">
          
          {/* Payout Cap Status Card */}
          <div className="revolut-card">
            <h3 className="card-title">Payout Limit Status</h3>
            <p className="card-desc">All yields and MLM matching commissions count towards your hard 200% payout limit.</p>
            
            <div className="cap-indicator">
              <div className="cap-labels">
                <span>Total Claimed</span>
                <span>{realTotalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {realMaxLimit.toLocaleString()} ARES</span>
              </div>
              <div className="cap-progress-container">
                <div 
                  className={`cap-progress-fill ${realFillPct >= 100 ? 'danger' : realFillPct > 80 ? 'warning' : ''}`} 
                  style={{ width: `${realFillPct}%` }}
                ></div>
              </div>
              {realFillPct >= 100 ? (
                <div className="cap-warning-banner" style={{ background: 'rgba(239,69,68,0.1)', border: '1px solid rgba(239,69,68,0.2)', color: 'var(--danger-color)' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>Limit reached! Please purchase a top-up plan to continue withdrawals.</span>
                </div>
              ) : null}
            </div>

            <div className="cap-details">
              <div className="cap-detail-row">
                <span>Active Plans Purchase</span>
                <strong>{realSelfInvestment.toLocaleString()} ARES</strong>
              </div>
              <div className="cap-detail-row">
                <span>Maximum Payout (2x)</span>
                <strong>{realMaxLimit.toLocaleString()} ARES</strong>
              </div>
              <div className="cap-detail-row">
                <span>Withdrawn Balance</span>
                <strong style={{ color: '#00D27A' }}>{realTotalClaimed.toLocaleString()} ARES</strong>
              </div>
              <div className="cap-detail-row">
                <span>Remaining Cap Capacity</span>
                <strong style={{ color: '#1970ff' }}>{realRemainingCap.toLocaleString()} ARES</strong>
              </div>
            </div>
          </div>

          {/* Withdrawal Center Card */}
          <div className="revolut-card">
            <h3 className="card-title">Withdrawal Center</h3>
            <p className="card-desc">
              {withdrawalType === 'metamask' 
                ? "Claims are split 50/50: 50% to MetaMask and 50% to your utility account (minus 10% admin fee)."
                : "Claims go 100% directly to your off-chain Utility Portal account balance (minus 10% admin fee)."
              }
            </p>

            {/* Selector */}
            <div className="preset-buttons" style={{ display: 'flex', gap: '4px', padding: '3px', background: '#16171e', borderRadius: '8px', marginBottom: '1rem' }}>
              <button 
                className={`btn-preset ${withdrawalType === 'metamask' ? 'active' : ''}`} 
                onClick={() => setWithdrawalType('metamask')}
                style={{ flex: 1, borderRadius: '6px', padding: '0.5rem', border: 'none', fontSize: '0.75rem', background: 'none' }}
              >
                MetaMask Split
              </button>
              <button 
                className={`btn-preset ${withdrawalType === 'utility' ? 'active' : ''}`} 
                onClick={() => setWithdrawalType('utility')}
                style={{ flex: 1, borderRadius: '6px', padding: '0.5rem', border: 'none', fontSize: '0.75rem', background: 'none' }}
              >
                Utility Wallet
              </button>
            </div>

            {/* Accrued Ticker */}
            <div className="reward-summary-box">
              <div className="reward-label">Accrued Rewards (Yield + MLM)</div>
              <div className="reward-amount">{accruedRewards.toFixed(6)} <span className="currency-sub">ARES</span></div>
            </div>

            {/* Info limits banner */}
            <div 
              className="withdrawal-limits-banner" 
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#16171e', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: '3px solid', borderLeftColor: withdrawalType === 'metamask' ? 'var(--primary-color)' : 'var(--success-color)' }}
            >
              <i className="fa-solid fa-circle-info"></i>{' '}
              <span>
                {withdrawalType === 'metamask'
                  ? "MetaMask Split requires a minimum of 100 ARES accrued. Payout splits 50/50 net of a 10% fee."
                  : "Utility Wallet Direct allows instant claim of any amount, but is limited to a maximum of 4 claims per month."
                }
              </span>
            </div>

            {/* Payout distribution projection */}
            {accruedRewards > 0 && realSelfInvestment > 0 ? (
              <div className="payout-projection">
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>Estimated Distribution</h4>
                <div className="projection-row">
                  <span>Admin Withdrawal Fee (10%):</span>
                  <span style={{ color: '#ef4444' }}>-{adminFee.toFixed(6)} ARES</span>
                </div>
                {withdrawalType === 'metamask' ? (
                  <>
                    <div className="projection-row">
                      <span>To MetaMask Wallet (50%):</span>
                      <span style={{ color: '#00d27a' }}>+{metamaskShare.toFixed(6)} ARES</span>
                    </div>
                    <div className="projection-row">
                      <span>To Utility Wallet (50%):</span>
                      <span style={{ color: '#1970ff' }}>+{utilityShare.toFixed(6)} ARES</span>
                    </div>
                  </>
                ) : (
                  <div className="projection-row">
                    <span>To Utility Wallet (100%):</span>
                    <span style={{ color: '#1970ff' }}>+{netClaimed.toFixed(6)} ARES</span>
                  </div>
                )}
              </div>
            ) : null}

            <button className="btn-primary" onClick={handleClaimRewards} disabled={txLoading}>
              {txLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : withdrawalType === 'metamask' ? 'Claim Split Payout' : 'Claim to Utility Wallet'}
            </button>

            {/* Dev Simulated Accrual Tool */}
            <div className="admin-accrual-section">
              <h4 style={{ textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Simulate Accrued Yield <span className="dev-badge">Dev Mode</span>
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '1' }}>
                  <input 
                    type="number" 
                    placeholder="Amount (ARES)" 
                    min="1" 
                    step="10" 
                    style={{ padding: '0.5rem', fontSize: '0.85rem', background: '#16171e', border: '1px solid var(--card-border)', borderRadius: '8px', color: '#ffffff', width: '100%' }}
                    value={simulationAddVal}
                    onChange={(e) => setSimulationAddVal(e.target.value)}
                  />
                </div>
                <button className="btn-secondary" style={{ flex: '0 0 80px', padding: '0.5rem 0', fontSize: '0.85rem', height: '38px', borderRadius: '8px' }} onClick={handleSimulateAccrual}>Add</button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Projections & Simulation Center Card (Moved to bottom) */}
      <div className="revolut-card" style={{ marginTop: '2rem' }}>
        <h3 className="card-title">
          <i className="fa-solid fa-flask" style={{ color: 'var(--primary-color)', marginRight: '0.5rem' }}></i>Projections &amp; Simulation Center
        </h3>
        <p className="card-desc">Simulate different staking amounts, direct sponsor size, and team business volume to see your simulated rank, unlocked levels, and earnings cap crossover projections.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ marginBottom: 0 }}>Simulated Self-Staking</label>
                <span style={{ fontWeight: '700', color: 'var(--primary-color)', fontSize: '0.95rem' }}>{simStaking.toLocaleString()} ARES</span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="100000" 
                step="100" 
                value={simStaking} 
                onChange={(e) => setSimStaking(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-color)' }}
              />
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>100</span>
                <span>25,000</span>
                <span>50,000</span>
                <span>100,000+</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ marginBottom: 0 }}>Simulated Direct Recruits</label>
                <span style={{ fontWeight: '700', color: 'var(--primary-color)', fontSize: '0.95rem' }}>{simDirects} {simDirects === 1 ? 'Partner' : 'Partners'}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="12" 
                step="1" 
                value={simDirects} 
                onChange={(e) => setSimDirects(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-color)' }}
              />
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>0</span>
                <span>4</span>
                <span>8</span>
                <span>12+</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ marginBottom: 0 }}>Simulated Team Volume</label>
                <span style={{ fontWeight: '700', color: 'var(--primary-color)', fontSize: '0.95rem' }}>{simTeamVolume.toLocaleString()} ARES</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1200000" 
                step="10000" 
                value={simTeamVolume} 
                onChange={(e) => setSimTeamVolume(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-color)' }}
              />
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>0</span>
                <span>150,000</span>
                <span>500,000</span>
                <span>1,000,000+</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ marginBottom: 0 }}>Simulated Downline Monthly Yield</label>
                <span style={{ fontWeight: '700', color: 'var(--primary-color)', fontSize: '0.95rem' }}>{simDownlineYield.toLocaleString()} ARES</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100000" 
                step="1000" 
                value={simDownlineYield} 
                onChange={(e) => setSimDownlineYield(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-color)' }}
              />
              <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>0</span>
                <span>25,000</span>
                <span>50,000</span>
                <span>100,000</span>
              </div>
            </div>
          </div>

          {/* Results & Graph */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="mlm-stats-row" style={{ marginTop: '0', background: '#0c0d12', border: '1px solid var(--card-border)' }}>
              <div className="mlm-stat-box">
                <div className="mlm-stat-label">Simulated Rank</div>
                <div className="mlm-stat-val" style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{simRank.name}</div>
              </div>
              <div className="mlm-stat-box">
                <div className="mlm-stat-label">Unlock Ratio</div>
                <div className="mlm-stat-val" style={{ color: 'var(--success-color)', fontSize: '1rem' }}>{getUnlockedLevelsCount(simRank)} / 10 Levels</div>
              </div>
              <div className="mlm-stat-box">
                <div className="mlm-stat-label">Months to Cap</div>
                <div className="mlm-stat-val" style={{ color: 'var(--warning-color)', fontSize: '1rem' }}>
                  {simMonthlyTotal > 0 ? `${simMonthsToCap.toFixed(1)} Months` : 'Never'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#16171e', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Monthly Staking Yield</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff' }}>{simMonthlyYield.toFixed(2)} ARES</div>
              </div>
              <div style={{ background: '#16171e', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Monthly Matching Bonus</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff' }}>{simMonthlyMatching.toFixed(2)} ARES</div>
              </div>
              <div style={{ background: '#16171e', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>2x Payout Cap Limit</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--danger-color)' }}>{simMaxCap.toLocaleString(undefined, { minimumFractionDigits: 2 })} ARES</div>
              </div>
            </div>

            {/* Canvas */}
            <div style={{ flex: '1', minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
              <label>12-Month Accumulation Projection &amp; Capping Crossover</label>
              <div style={{ width: '100%', height: '180px', background: '#0c0d12', border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden', marginTop: '0.5rem' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Partner Detail Inspector Modal */}
      {showModal && inspectedPartner && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Partner Profile</h3>
              <button style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ marginTop: '1.5rem' }}>
              <div className="modal-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="detail-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}><i className="fa-solid fa-user"></i> Full Name</span>
                  <span className="detail-value" style={{ fontWeight: '600', fontSize: '1.1rem', marginTop: '0.25rem' }}>{inspectedPartner.name}</span>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="detail-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}><i className="fa-solid fa-phone"></i> Mobile Number</span>
                  <span className="detail-value" style={{ fontWeight: '600', fontSize: '1.1rem', marginTop: '0.25rem' }}>{inspectedPartner.mobile}</span>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
                  <span className="detail-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}><i className="fa-solid fa-wallet"></i> Wallet Address</span>
                  <span className="detail-value monospace" style={{ fontFamily: 'monospace', background: '#16171e', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem', overflowX: 'auto' }}>{inspectedPartner.walletAddress}</span>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="detail-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}><i className="fa-solid fa-piggy-bank"></i> Self Staking Investment</span>
                  <span className="detail-value highlight-success" style={{ color: 'var(--success-color)', fontWeight: '700', fontSize: '1.1rem', marginTop: '0.25rem' }}>{inspectedPartner.selfInvestment.toLocaleString()} ARES</span>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="detail-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}><i className="fa-solid fa-sitemap"></i> Team Business Volume</span>
                  <span className="detail-value highlight-primary" style={{ color: 'var(--primary-color)', fontWeight: '700', fontSize: '1.1rem', marginTop: '0.25rem' }}>{inspectedPartner.teamVolume.toLocaleString()} ARES</span>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="detail-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}><i className="fa-solid fa-users"></i> Direct Recruits</span>
                  <span className="detail-value" style={{ fontWeight: '600', fontSize: '1.1rem', marginTop: '0.25rem' }}>{inspectedPartner.directs}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'toast-error' : 'toast-success'}`}>
        <span>
          {toast.isError 
            ? <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--danger-color)' }}></i> 
            : <i className="fa-solid fa-circle-check" style={{ color: 'var(--success-color)' }}></i>
          }
        </span>
        <span>{toast.message}</span>
      </div>

    </div>
  );
}
