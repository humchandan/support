'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import AdminView from './AdminView';
import { waitForTransactionReceiptWithRetry } from '../lib/txWaiter';

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

export default function UtilityPortalView() {
  const { userAddress, jwtToken, userProfile, provider, signer, disconnectWallet, loadProfile } = useWeb3();
  const router = useRouter();

  const ADMIN_ADDRESSES = [
    '0xd01c1bfc96e22a9470c186e69e0a97e18eff23e6'
  ];
  const isAdminAddress = userAddress && ADMIN_ADDRESSES.includes(userAddress.toLowerCase());

  // Navigation tab state
  const [activePortalTab, setActivePortalTab] = useState('portal'); // 'portal' | 'admin'

  // Ledger state
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [proxyAddress, setProxyAddress] = useState(null);
  const [custodianBalance, setCustodianBalance] = useState(0);

  // Catalog state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [userRequests, setUserRequests] = useState([]);
  const [sideTab, setSideTab] = useState('ledger'); // 'ledger' | 'requests'

  // Spend form states
  const [dynamicAnswers, setDynamicAnswers] = useState({});
  const [uploadingField, setUploadingField] = useState({});

  const [exactAmount, setExactAmount] = useState('');
  const [spendAmount, setSpendAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const [isPrefilled, setIsPrefilled] = useState(false);
  const [rechargeReminder, setRechargeReminder] = useState(null);
  const [activeSavedAccountId, setActiveSavedAccountId] = useState(null);

  // Toast alert state
  const [toast, setToast] = useState({ message: '', show: false, isError: false });

  const showToast = (message, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const CUSTODY_WALLET_ADDRESS = "0xD01c1BFC96E22A9470C186E69E0A97e18EfF23e6";

  const loadLedgerAndProxy = async () => {
    if (!jwtToken || !userAddress) return;
    try {
      let activeProxy = null;
      if (userProfile && userProfile.proxyAddress) {
        activeProxy = userProfile.proxyAddress;
        if (provider) {
          try {
            const code = await provider.getCode(userProfile.proxyAddress);
            if (code === '0x' || code === '0x00') {
              activeProxy = null;
            }
          } catch (codeErr) {
            console.error("Failed to verify proxy wallet deployment:", codeErr);
          }
        }
      }
      setProxyAddress(activeProxy);
      const balanceRes = await fetch(`/api/ledger/balance`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const balanceData = await balanceRes.json();
      if (balanceData && balanceData.balance !== undefined) {
        setBalance(Number(balanceData.balance) || 0);
        setTransactions(balanceData.transactions || []);
      }
    } catch (err) {
      console.error("Failed to load portal details:", err);
    }
  };

  const loadCatalogData = async () => {
    if (!jwtToken) return;
    try {
      const res = await fetch('/api/admin/utility/categories', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (res.ok && data.categories) {
        setCategories(data.categories);
        if (data.categories.length > 0) {
          setSelectedCategory(prev => {
            const found = data.categories.find(c => c.id === prev?.id);
            return found || data.categories[0];
          });
        }
      }
    } catch (err) {
      console.error("Failed to load dynamic catalog categories:", err);
    }
  };

  const loadUserRequests = async () => {
    if (!jwtToken) return;
    try {
      const res = await fetch('/api/user/utility/requests', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (res.ok && data.requests) {
        setUserRequests(data.requests);
      }
    } catch (err) {
      console.error("Failed to load user utility requests:", err);
    }
  };

  // Sync selectedService if selectedCategory changes
  useEffect(() => {
    if (selectedCategory) {
      if (selectedCategory.services && selectedCategory.services.length > 0) {
        setSelectedService(prev => {
          const found = selectedCategory.services.find(s => s.id === prev?.id);
          return found || selectedCategory.services[0];
        });
      } else {
        setSelectedService(null);
      }
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadLedgerAndProxy();
    loadCatalogData();
    loadUserRequests();
    const interval = setInterval(() => {
      loadLedgerAndProxy();
      loadCatalogData();
      loadUserRequests();
    }, 30000); // 30s — avoid RPC spam
    return () => clearInterval(interval);
  }, [jwtToken, userAddress, userProfile, provider]);

  // Prefill details and check 30-day reminder (PhonePe style)
  useEffect(() => {
    if (!selectedService || userRequests.length === 0) {
      setDynamicAnswers({});
      setIsPrefilled(false);
      setRechargeReminder(null);
      setExactAmount('');
      setSpendAmount('');
      setActiveSavedAccountId(null);
      return;
    }

    // Find the latest request for the selected service
    const latestReq = userRequests.find(r => r.serviceId === selectedService.id);

    if (latestReq) {
      try {
        const parsedDetails = JSON.parse(latestReq.details || '{}');
        setDynamicAnswers(parsedDetails);
        setIsPrefilled(true);
        setActiveSavedAccountId(latestReq.id);

        // Check if last request was more than 30 days ago
        const lastRechargeDate = new Date(latestReq.timestamp);
        const diffTime = Math.abs(Date.now() - lastRechargeDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 30) {
          setRechargeReminder({
            days: diffDays,
            dateString: lastRechargeDate.toLocaleDateString(),
            detailsString: Object.entries(parsedDetails)
              .filter(([k, v]) => typeof v === 'string' && v.length < 30)
              .map(([k, v]) => `${v}`)
              .join(', ')
          });
        } else {
          setRechargeReminder(null);
        }
      } catch (e) {
        console.error("Failed to parse previous request details:", e);
        setDynamicAnswers({});
        setIsPrefilled(false);
        setRechargeReminder(null);
        setActiveSavedAccountId(null);
      }
    } else {
      setDynamicAnswers({});
      setIsPrefilled(false);
      setRechargeReminder(null);
      setActiveSavedAccountId(null);
      setExactAmount('');
      setSpendAmount('');
    }
  }, [selectedService, userRequests]);

  const handleCreateProxy = async () => {
    if (!signer) return;
    try {
      setLoading(true);
      showToast("Generating your private utility wallet...", false);

      const supportResponse = await fetch("/contracts/PortalFactory.json");
      const supportData = await supportResponse.json();
      const factoryContract = new ethers.Contract(supportData.address, supportData.abi, signer);

      const userId = ethers.keccak256(ethers.toUtf8Bytes("portal_user_" + userAddress.toLowerCase()));

      const tx = await factoryContract.createPortal(userId, {
        gasPrice: ethers.parseUnits("1.5", "gwei")
      });
      const receipt = await waitForTransactionReceiptWithRetry(signer.provider || provider, tx.hash);

      // Parse transaction logs to find the deployed clone address
      let proxyAddr = null;
      for (const log of receipt.logs) {
        try {
          const parsedLog = factoryContract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === "PortalCreated") {
            proxyAddr = parsedLog.args.portalAddress;
            break;
          }
        } catch (e) {
          // Skip unparseable logs
        }
      }

      if (proxyAddr) {
        // Update database user record with the proxyAddress
        await fetch("/api/user/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${jwtToken}`
          },
          body: JSON.stringify({ proxyAddress: proxyAddr })
        });

        // Reload global userProfile to update state dynamically
        await loadProfile();
        setProxyAddress(proxyAddr);
        showToast("Proxy wallet deployed and saved successfully!", false);
      } else {
        throw new Error("Could not retrieve proxy address from transaction logs.");
      }
    } catch (err) {
      console.error("Factory deploy failed:", err);
      showToast(getFriendlyErrorMessage(err), true);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositProxy = async () => {
    if (!signer || !proxyAddress) return;
    const amount = parseFloat(depositAmount) || 0;
    if (amount <= 0) {
      showToast("Enter a positive deposit amount!", true);
      return;
    }

    try {
      setLoading(true);
      showToast(`Depositing ${amount} ARES to proxy... Confirm in wallet...`, false);
      const tx = await signer.sendTransaction({
        to: proxyAddress,
        value: ethers.parseEther(amount.toString()),
        gasPrice: ethers.parseUnits("1.5", "gwei")
      });
      await waitForTransactionReceiptWithRetry(signer.provider || provider, tx.hash);
      showToast(`Successfully deposited ${amount} ARES! Auto-sweeper will credit your ledger balance shortly.`, false);
      setDepositAmount('');
      loadLedgerAndProxy();
    } catch (err) {
      console.error("Proxy deposit failed:", err);
      showToast(getFriendlyErrorMessage(err), true);
    } finally {
      setLoading(false);
    }
  };

  const handleSpend = async (e) => {
    e.preventDefault();
    const amount = parseFloat(spendAmount) || 0;
    if (amount <= 0) {
      showToast("Enter a positive spending amount!", true);
      return;
    }
    if (balance < amount) {
      showToast("Insufficient utility credit balance!", true);
      return;
    }
    if (!selectedService) {
      showToast("Please select a utility service option!", true);
      return;
    }
    const minSvc = Number(selectedService.minAmount);
    const maxSvc = Number(selectedService.maxAmount);
    if (amount < minSvc || amount > maxSvc) {
      showToast(`Spend amount must be between ${minSvc} and ${maxSvc} ARES!`, true);
      return;
    }

    let customFieldsArray = [];
    try {
      customFieldsArray = selectedService.customFields ? JSON.parse(selectedService.customFields) : [];
    } catch (err) {
      customFieldsArray = [];
    }
    if (!Array.isArray(customFieldsArray)) customFieldsArray = [];

    // Validate fields
    for (const f of customFieldsArray) {
      const val = dynamicAnswers[f.name];
      if (!val) {
        showToast(`Please fill out/upload: ${f.label}`, true);
        return;
      }
    }

    const details = dynamicAnswers;

    try {
      setLoading(true);
      showToast("Submitting recharge utility request...", false);

      const res = await fetch(`/api/ledger/spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ amount, serviceId: selectedService.id, details })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Utility request submitted! Req #${data.request.id} is pending approval.`, false);
        setExactAmount('');
        setSpendAmount('');
        setDynamicAnswers({});
        loadLedgerAndProxy();
        loadUserRequests();
      } else {
        showToast(data.error || "Request failed.", true);
      }
    } catch (err) {
      console.error("Spend transaction failed:", err);
      showToast("Request execution failed.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!recipient || !transferAmount) {
      showToast("Recipient and amount are required!", true);
      return;
    }
    const amount = parseFloat(transferAmount) || 0;
    if (amount <= 0) {
      showToast("Enter a positive transfer amount!", true);
      return;
    }
    if (balance < amount) {
      showToast("Insufficient utility credit balance!", true);
      return;
    }

    try {
      setLoading(true);
      showToast("Processing internal credit transfer...", false);

      const res = await fetch(`/api/ledger/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ recipient, amount: transferAmount })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Successfully sent utility credit! Net received: ${data.netAmount.toFixed(2)} ARES (5% fee deducted).`, false);
        setRecipient('');
        setTransferAmount('');
        loadLedgerAndProxy();
      } else {
        showToast(data.error || "Transfer failed.", true);
      }
    } catch (err) {
      console.error("Transfer failed:", err);
      showToast("Transfer execution failed.", true);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Proxy address copied!", false);
  };

  const formattedAddress = userAddress
    ? `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`
    : 'Not connected';

  const formattedProxy = proxyAddress
    ? `${proxyAddress.substring(0, 6)}...${proxyAddress.substring(proxyAddress.length - 4)}`
    : '';

  const formattedCustody = `${CUSTODY_WALLET_ADDRESS.substring(0, 6)}...${CUSTODY_WALLET_ADDRESS.substring(CUSTODY_WALLET_ADDRESS.length - 4)}`;

  return (
    <div id="utility-portal-view" className="w-full min-h-screen bg-black text-white font-sans">

      {/* Toast Notification Banner */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'toast-error' : 'toast-success'}`}>
        <i className={toast.isError ? 'fa-solid fa-circle-exclamation text-red-500' : 'fa-solid fa-circle-check text-green-500'}></i>
        <span>{toast.message}</span>
      </div>

      {/* Unified Top Header Bar */}
      <header className="revolut-header">
        <div className="header-container">
          <div className="flex items-center gap-8">
            <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/logo.png" alt="Aries logo" style={{ height: '24px', width: 'auto' }} />
              <span>Aries<span className="dot">.</span></span>
            </div>

            {/* Header Navigation Tab Buttons */}
            <nav className="flex items-center flex-wrap gap-2 text-xs sm:text-sm font-semibold mt-2 sm:mt-0">
              <button
                onClick={() => router.push('/app')}
                className="text-zinc-400 hover:text-white px-3 py-1.5 transition-colors flex items-center"
              >
                <i className="fa-solid fa-sitemap mr-1.5"></i> MLM Dashboard
              </button>
              <button
                onClick={() => setActivePortalTab('portal')}
                className={`px-3 py-1.5 rounded-full transition-colors flex items-center ${activePortalTab === 'portal' ? 'text-white bg-[#252836] cursor-default' : 'text-zinc-400 hover:text-white'}`}
              >
                <i className="fa-solid fa-wallet mr-1.5"></i> Utility Portal
              </button>
              {isAdminAddress && (
                <button
                  onClick={() => setActivePortalTab('admin')}
                  className={`px-3 py-1.5 rounded-full transition-colors flex items-center ${activePortalTab === 'admin' ? 'text-white bg-[#252836] cursor-default' : 'text-zinc-400 hover:text-white'}`}
                >
                  <i className="fa-solid fa-user-shield mr-1.5"></i> Admin Panel
                </button>
              )}
            </nav>
          </div>

          <div className="header-actions">
            <div className="connection-status">
              <span className="status-indicator online"></span>
              <span>Utility Gateway</span>
            </div>
            <button className="btn-connect" onClick={disconnectWallet} title="Click to disconnect">
              <i className="fa-solid fa-circle-check"></i> {formattedAddress}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      {activePortalTab === 'admin' ? (
        <AdminView />
      ) : (
        <main className="revolut-container py-10">

          {/* Balance Hero Section */}
          <section className="balance-hero mb-10 mt-2">
            <div className="balance-label">Available Utility Balance</div>
            <div className="balance-amount text-blue-500">
              {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="currency text-zinc-500">ARES</span>
            </div>
            <div className="wallet-address-sub">Proxy wallet: {proxyAddress || 'None Generated'}</div>
          </section>

          {/* 2-Column Dashboard Grid */}
          <div className="grid-layout">

            {/* Left Column: Spending Center & Proxy Management */}
            <div className="main-column">

              {/* Consumer Utility Spending Center */}
              <div className="revolut-card">
                <h3 className="card-title">Utility Spending Center</h3>
                <p className="card-desc">Spend your available off-chain ledger credit balance on bills, mobile recharges, or shopping vouchers dynamically.</p>

                {/* Category Segmented Tabs */}
                {categories.length === 0 ? (
                  <div className="text-center text-xs text-zinc-650 py-8">
                    No utility payment categories configured yet.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#16171e] p-1.5 rounded-xl mb-6">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            const defaultSvc = cat.services && cat.services.length > 0 ? cat.services[0] : null;
                            setSelectedService(defaultSvc);
                            // Clear dynamic values
                            setDynamicAnswers({});
                          }}
                          className={`py-2 px-1 text-center rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${selectedCategory?.id === cat.id ? 'bg-[#252836] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          <i className={`fa-solid ${cat.icon || 'fa-tag'}`}></i>
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Service Selector (Only if Category has multiple services) */}
                    {selectedCategory?.services && selectedCategory.services.length > 0 && (
                      <div className="form-group mb-4">
                        <label htmlFor="spend-service-select">Select Service Option</label>
                        <select
                          id="spend-service-select"
                          value={selectedService?.id || ''}
                          onChange={(e) => {
                            const svcId = parseInt(e.target.value);
                            const svc = selectedCategory?.services?.find(s => s.id === svcId);
                            setSelectedService(svc);
                          }}
                          className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white"
                        >
                          {selectedCategory.services.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Limit helper card */}
                    {selectedService && (
                      <div className="bg-[#16171e] p-3 rounded-lg border border-zinc-850 text-[11px] text-zinc-400 space-y-1.5 mb-4">
                        <div className="flex justify-between">
                          <span>Description:</span>
                          <span className="text-zinc-300 text-right">{selectedService.description}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Allowed Limits:</span>
                          <span className="font-mono text-blue-400">{Number(selectedService.minAmount)} - {Number(selectedService.maxAmount)} ARES</span>
                        </div>
                      </div>
                    )}

                    {/* Saved / Recent Accounts Selector (PhonePe style) */}
                    {(() => {
                      if (!selectedService) return null;
                      const serviceRequests = userRequests.filter(r => r.serviceId === selectedService.id);
                      const uniqueAccounts = [];
                      const seenKeys = new Set();

                      // Load hidden prefetches from localStorage
                      let hiddenIds = [];
                      try {
                        const stored = localStorage.getItem('hidden_prefetches');
                        if (stored) hiddenIds = JSON.parse(stored);
                      } catch (e) {}

                      for (const req of serviceRequests) {
                        try {
                          if (hiddenIds.includes(req.id)) continue; // skip deleted ones
                          
                          const details = JSON.parse(req.details || '{}');
                          const key = Object.entries(details)
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([k, v]) => `${k}:${v}`)
                            .join('|');
                            
                          if (key && !seenKeys.has(key)) {
                            seenKeys.add(key);
                            uniqueAccounts.push({
                              id: req.id,
                              details,
                              timestamp: req.timestamp
                            });
                          }
                        } catch (e) {}
                      }

                      // Limit history to top 5 most recent unique accounts to prevent UI clutter (e.g., if they have 20+ cards)
                      const displayAccounts = uniqueAccounts.slice(0, 5);

                      if (displayAccounts.length === 0) return null;

                      const handleDeletePrefetch = (e, reqId) => {
                        e.stopPropagation();
                        if (!confirm("Are you sure you want to remove this saved account?")) return;
                        
                        try {
                          const stored = localStorage.getItem('hidden_prefetches');
                          const currentHidden = stored ? JSON.parse(stored) : [];
                          const updated = [...currentHidden, reqId];
                          localStorage.setItem('hidden_prefetches', JSON.stringify(updated));
                        } catch (err) {
                          console.error(err);
                        }

                        // Clear if active
                        if (activeSavedAccountId === reqId) {
                          setDynamicAnswers({});
                          setActiveSavedAccountId(null);
                          setIsPrefilled(false);
                          setRechargeReminder(null);
                        }
                        
                        // Force refresh requests state
                        loadUserRequests();
                      };

                      return (
                        <div className="mb-4 text-left">
                          <label className="block text-xs font-semibold text-zinc-400 mb-2">Saved Accounts / Previous Bills</label>
                          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                            {displayAccounts.map(acc => {
                              const desc = Object.entries(acc.details)
                                .filter(([k, v]) => typeof v === 'string' && v.length < 25)
                                .map(([k, v]) => `${v}`)
                                .join(' - ');

                              const isActive = activeSavedAccountId === acc.id;

                              return (
                                <div key={acc.id} className="relative group flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDynamicAnswers(acc.details);
                                      setActiveSavedAccountId(acc.id);
                                      setIsPrefilled(true);
                                      
                                      const lastRechargeDate = new Date(acc.timestamp);
                                      const diffTime = Math.abs(Date.now() - lastRechargeDate.getTime());
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                      if (diffDays > 30) {
                                        setRechargeReminder({
                                          days: diffDays,
                                          dateString: lastRechargeDate.toLocaleDateString(),
                                          detailsString: desc
                                        });
                                      } else {
                                        setRechargeReminder(null);
                                      }
                                    }}
                                    className={`text-left px-3.5 py-2 pr-8 rounded-lg border text-xs transition-all duration-200 ${
                                      isActive 
                                        ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                                        : 'bg-[#16171e] border-zinc-800 text-zinc-350 hover:border-zinc-700'
                                    }`}
                                  >
                                    <div className="font-bold flex items-center gap-1.5 mb-0.5">
                                      <i className={`fa-solid ${isActive ? 'fa-circle-check text-blue-400' : 'fa-history text-zinc-500'}`}></i>
                                      <span>{desc || `Bill #${acc.id}`}</span>
                                    </div>
                                    <span className="text-[9px] text-zinc-500 block">
                                      Last paid: {new Date(acc.timestamp).toLocaleDateString()}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeletePrefetch(e, acc.id)}
                                    className="absolute right-2 top-2.5 text-zinc-500 hover:text-red-500 p-0.5 transition-colors"
                                    title="Delete saved details"
                                  >
                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                  </button>
                                </div>
                              );
                            })}
                            
                            <button
                              type="button"
                              onClick={() => {
                                setDynamicAnswers({});
                                setActiveSavedAccountId(null);
                                setIsPrefilled(false);
                                setRechargeReminder(null);
                                setExactAmount('');
                                setSpendAmount('');
                              }}
                              className={`flex-shrink-0 text-left px-3.5 py-2 rounded-lg border text-xs transition-all duration-200 ${
                                activeSavedAccountId === null 
                                  ? 'bg-zinc-800/20 border-zinc-700 text-zinc-300' 
                                  : 'bg-[#16171e]/40 border-dashed border-zinc-800 text-zinc-400 hover:border-zinc-700'
                              }`}
                            >
                              <div className="font-bold flex items-center gap-1.5">
                                <i className="fa-solid fa-plus-circle text-zinc-400"></i>
                                <span>New Details</span>
                              </div>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Prefill & 30-day warning badges */}
                    {isPrefilled && (
                      <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-950/20 border border-blue-900/30 p-2.5 rounded-lg mb-4 animate-fade-in">
                        <i className="fa-solid fa-magic text-blue-400"></i>
                        <span>Prefetched details from your last recharge. You can edit them freely.</span>
                      </div>
                    )}
                    {rechargeReminder && (
                      <div className="flex flex-col gap-1 text-xs text-yellow-500 bg-yellow-950/20 border border-yellow-900/30 p-3 rounded-lg mb-4 animate-fade-in">
                        <div className="flex items-center gap-1.5 font-bold">
                          <i className="fa-solid fa-triangle-exclamation text-yellow-500"></i>
                          <span>Recharge Reminder!</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          It has been <strong>{rechargeReminder.days} days</strong> since your last recharge ({rechargeReminder.dateString}) for this account ({rechargeReminder.detailsString}). Please consider recharging now.
                        </p>
                      </div>
                    )}

                    {/* Spend execution Form */}
                    <form onSubmit={handleSpend} className="space-y-4 text-left">
                      {(() => {
                        let customFieldsArray = [];
                        try {
                          customFieldsArray = selectedService?.customFields ? JSON.parse(selectedService.customFields) : [];
                        } catch (e) {
                          customFieldsArray = [];
                        }
                        if (!Array.isArray(customFieldsArray)) customFieldsArray = [];

                        if (customFieldsArray.length === 0) {
                          return (
                            <div className="bg-[#16171e] p-4 rounded-xl text-xs text-zinc-500 mb-4 border border-zinc-900 text-center">
                              No additional input details required for this utility service. Enter payment amount below.
                            </div>
                          );
                        }

                        return customFieldsArray.map(f => {
                          if (f.type === 'file') {
                            const fileUrl = dynamicAnswers[f.name] || '';
                            return (
                              <div className="form-group mb-4 animate-fade-in" key={f.name}>
                                <label>{f.label}</label>
                                {fileUrl && (
                                  <div className="text-xs text-green-500 mb-2 flex items-center gap-1.5 font-semibold">
                                    <i className="fa-solid fa-circle-check text-green-500"></i>
                                    <span>Uploaded:</span>
                                    <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline monospace truncate max-w-[200px]">
                                      {fileUrl.substring(fileUrl.lastIndexOf('/') + 1)}
                                    </a>
                                  </div>
                                )}
                                <label className="btn-secondary cursor-pointer block text-center !py-2.5 !text-xs font-semibold">
                                  {uploadingField[f.name] ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-upload mr-1"></i>}
                                  {fileUrl ? 'Replace Uploaded Copy' : `Upload ${f.label}`}
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files[0];
                                      if (!file) return;
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      setUploadingField(prev => ({ ...prev, [f.name]: true }));
                                      try {
                                        const res = await fetch('/api/user/upload', {
                                          method: 'POST',
                                          headers: {
                                            'Authorization': `Bearer ${jwtToken}`
                                          },
                                          body: formData
                                        });
                                        const data = await res.json();
                                        if (res.ok && data.url) {
                                          setDynamicAnswers(prev => ({ ...prev, [f.name]: data.url }));
                                          showToast("Document uploaded successfully!", false);
                                        } else {
                                          showToast(data.error || "Upload failed", true);
                                        }
                                      } catch (err) {
                                        showToast("Upload failed.", true);
                                      } finally {
                                        setUploadingField(prev => ({ ...prev, [f.name]: false }));
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            );
                          }

                          return (
                            <div className="form-group mb-4" key={f.name}>
                              <label htmlFor={`field-${f.name}`}>{f.label}</label>
                              <input
                                type={f.type === 'number' ? 'number' : 'text'}
                                id={`field-${f.name}`}
                                placeholder={f.placeholder || `Enter ${f.label}`}
                                value={dynamicAnswers[f.name] || ''}
                                onChange={(e) => setDynamicAnswers(prev => ({ ...prev, [f.name]: e.target.value }))}
                              />
                            </div>
                          );
                        });
                      })()}

                      <div className="form-group mb-4">
                        <label htmlFor="exact-amount">Exact Bill Amount (in Fiat/Local Currency)</label>
                        <div className="input-container">
                          <input
                            type="number"
                            id="exact-amount"
                            placeholder="Enter exact bill amount to pay"
                            min="0"
                            step="any"
                            value={exactAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExactAmount(val);
                              if (val && !isNaN(Number(val))) {
                                setSpendAmount((parseFloat(val) / 10).toString());
                              } else {
                                setSpendAmount('');
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="spend-amount">Amount in ARES (Autopopulated)</label>
                        <div className="input-container">
                          <input
                            type="number"
                            id="spend-amount"
                            placeholder="Auto generated amount in Ares"
                            value={spendAmount}
                            readOnly
                            className="bg-[#1b1c24]/50 cursor-not-allowed text-zinc-400 border border-zinc-800"
                          />
                          <span className="input-suffix">ARES</span>
                        </div>
                      </div>

                      <button type="submit" className="btn-primary" disabled={loading || !selectedService}>
                        {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Submit Spending Request'}
                      </button>
                    </form>
                  </>
                )}
              </div>

              {/* Utility Proxy Wallet Details */}
              <div className="revolut-card">
                <h3 className="card-title">Utility Gateway Wallet</h3>
                <p className="card-desc">Funds sent to this wallet are automatically credited to your available utility balance after verification which can take upto 6 hours.</p>

                {!proxyAddress ? (
                  <div className="proxy-state-box">
                    <i className="fa-solid fa-wallet text-4xl text-zinc-800 mb-4"></i>
                    <h4>No Utility Wallet Found</h4>
                    <p className="text-zinc-500 text-sm mb-6 max-w-xs">Deploy your unique low-gas proxy wallet copy to enable direct deposits.</p>
                    <button className="btn-primary" onClick={handleCreateProxy} disabled={loading}>
                      {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Create Utility Address'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 text-left">
                    <div className="form-group mb-0">
                      <label>Your Proxy Deposit Address</label>
                      <div className="flex gap-2">
                        <input type="text" value={proxyAddress} readOnly className="font-mono text-sm" />
                        <button className="btn-secondary !w-12 !p-0" title="Copy Address" onClick={() => copyToClipboard(proxyAddress)}>
                          <i className="fa-solid fa-copy"></i>
                        </button>
                      </div>
                    </div>

                    <div className="form-group mb-0">
                      <label htmlFor="deposit-amount"> Deposit to Utility wallet from External Wallet</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          id="deposit-amount"
                          placeholder="Amount in ARES"
                          min="1"
                          step="1"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                        <button className="btn-primary !w-32" onClick={handleDepositProxy} disabled={loading}>
                          {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Deposit'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Send Utility Wallet Balance (Internal Transfer) */}
              {proxyAddress && (
                <div className="revolut-card" id="internal-transfer-card">
                  <h3 className="card-title">Send Utility Wallet Balance (Internal)</h3>
                  <p className="card-desc">Transfer available utility portal wallet balance to another user's utility wallet instantly. A 2.0% fee is deducted. Transfers to unregistered external wallets are automatically rejected.</p>

                  <form onSubmit={handleTransfer} className="space-y-4 text-left">
                    <div className="form-group mb-0">
                      <label htmlFor="transfer-recipient">Recipient Address (MetaMask or Proxy)</label>
                      <input
                        type="text"
                        id="transfer-recipient"
                        placeholder="Enter 0x... address"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="transfer-amount">Amount to Send</label>
                      <div className="input-container">
                        <input
                          type="number"
                          id="transfer-amount"
                          placeholder="Amount (ARES)"
                          min="1"
                          step="1"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white"
                        />
                        <span className="input-suffix">ARES</span>
                      </div>
                      {transferAmount && parseFloat(transferAmount) > 0 && (
                        <small className="helper-text text-zinc-500 text-[11px] mt-1.5 block">
                          Deducts 2% fee: {(parseFloat(transferAmount) * 0.02).toFixed(2)} ARES. Recipient receives: {(parseFloat(transferAmount) * 0.98).toFixed(2)} ARES.
                        </small>
                      )}
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Send Instantly'}
                    </button>
                  </form>
                </div>
              )}

            </div>

            {/* Right Column: Ledger Transaction History & Requests History logs */}
            <div className="side-column">
              <div className="revolut-card">

                {/* Tab Selector */}
                <div className="flex border-b border-zinc-900 mb-6 pb-2 gap-4">
                  <button
                    onClick={() => setSideTab('ledger')}
                    className={`text-sm font-semibold pb-1.5 border-b-2 transition-all duration-200 ${sideTab === 'ledger' ? 'text-white border-blue-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                  >
                    <i className="fa-solid fa-list-ul mr-1.5"></i> Ledger
                  </button>
                  <button
                    onClick={() => setSideTab('requests')}
                    className={`text-sm font-semibold pb-1.5 border-b-2 transition-all duration-200 ${sideTab === 'requests' ? 'text-white border-blue-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                  >
                    <i className="fa-solid fa-clock-rotate-left mr-1.5"></i> Requests
                    {userRequests.filter(r => r.status === 'PENDING').length > 0 && (
                      <span className="ml-1.5 bg-yellow-500/20 text-yellow-500 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-yellow-500/30">
                        {userRequests.filter(r => r.status === 'PENDING').length}
                      </span>
                    )}
                  </button>
                </div>

                {sideTab === 'ledger' ? (
                  <div>
                    <p className="card-desc mb-4">Full ledger log of claims, deposits, internal transfers, and approved spend transactions.</p>
                    <div className="tx-history-list text-left max-h-[500px] overflow-y-auto pr-1">
                      {transactions.length === 0 ? (
                        <div className="tx-item-empty">No ledger entries logged yet.</div>
                      ) : (
                        transactions.map(tx => {
                          const isReceived = tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' || tx.type === 'CLAIM_DIRECT' || tx.type === 'SPEND_REFUND';
                          const amtStr = isReceived ? `+${Number(tx.netAmount).toFixed(2)} ARES` : `-${Number(tx.amount).toFixed(2)} ARES`;
                          const amtClass = isReceived ? "tx-amount in !text-emerald-400 font-mono font-bold text-xs" : "tx-amount out !text-zinc-400 font-mono font-bold text-xs";

                          return (
                            <div className="tx-item py-3 border-b border-zinc-900/60" key={tx.id}>
                              <div className="tx-item-left">
                                <span className="tx-type text-white font-semibold flex items-center gap-1.5 text-xs">
                                  {tx.type === 'SPEND' ? (
                                    <i className="fa-solid fa-cart-shopping text-blue-400 text-xs"></i>
                                  ) : tx.type === 'SPEND_PENDING' ? (
                                    <i className="fa-solid fa-hourglass-half text-yellow-500 text-xs"></i>
                                  ) : tx.type === 'SPEND_REFUND' ? (
                                    <i className="fa-solid fa-rotate-left text-green-400 text-xs"></i>
                                  ) : isReceived ? (
                                    <i className="fa-solid fa-arrow-down-long text-emerald-400 text-xs"></i>
                                  ) : (
                                    <i className="fa-solid fa-arrow-up-long text-zinc-400 text-xs"></i>
                                  )}
                                  {tx.type}
                                </span>
                                <span className="tx-time text-zinc-400 text-xs mt-0.5">
                                  {tx.description}
                                </span>
                                <span className="text-[9px] text-zinc-600 mt-1 block">
                                  {new Date(tx.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <span className={amtClass}>{amtStr}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="card-desc mb-4">Pending and processed utility purchases. Rejected requests issue immediate off-chain balance refunds.</p>
                    <div className="tx-history-list text-left max-h-[500px] overflow-y-auto pr-1">
                      {userRequests.length === 0 ? (
                        <div className="tx-item-empty">No utility requests submitted yet.</div>
                      ) : (
                        userRequests.map(req => {
                          const statusClass =
                            req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                              req.status === 'APPROVED' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                'bg-red-500/10 text-red-500 border-red-500/20';

                          let detailsObj = {};
                          try { detailsObj = JSON.parse(req.details || '{}'); } catch (e) { }

                          return (
                            <div className="tx-item !flex-col !items-start gap-2.5 py-4 border-b border-zinc-900/60" key={req.id}>
                              <div className="flex justify-between w-full items-start">
                                <div>
                                  <span className="tx-type text-white font-bold flex items-center gap-1.5 text-xs">
                                    <i className="fa-solid fa-receipt text-zinc-500 text-xs"></i>
                                    Req #{req.id}: {req.serviceName}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                                    {req.categoryName}
                                  </span>
                                </div>
                                <span className="tx-amount out text-zinc-200 font-mono font-bold text-xs">
                                  -{Number(req.amount).toFixed(2)} ARES
                                </span>
                              </div>

                              {/* Dynamic Details Box */}
                              <div className="bg-[#111218] p-2.5 rounded-lg w-full text-[10px] text-zinc-400 space-y-1">
                                {Object.entries(detailsObj).map(([k, v]) => {
                                  const isFile = typeof v === 'string' && v.startsWith('/uploads/');
                                  return (
                                    <div key={k} className="flex justify-between items-center py-0.5">
                                      <span className="text-zinc-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                                      {isFile ? (
                                        <a href={v as string} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline monospace">
                                          View Uploaded File <i className="fa-solid fa-up-right-from-square text-[8px] ml-0.5"></i>
                                        </a>
                                      ) : (
                                        <span className="text-zinc-350 font-medium">{v as React.ReactNode}</span>
                                      )}
                                    </div>
                                  );
                                })}

                                <div className="flex justify-between border-t border-zinc-800/60 mt-2 pt-2 items-center">
                                  <span>Status:</span>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusClass}`}>{req.status}</span>
                                </div>

                                {req.adminNotes && (
                                  <div className={`mt-2 pt-2 border-t border-zinc-800/60 italic text-[9.5px] ${req.status === 'APPROVED' ? 'text-green-400' : 'text-red-400/90'}`}>
                                    <strong>Ares says:</strong> "{req.adminNotes}"
                                  </div>
                                )}

                                {req.receiptUrl && (
                                  <div className="mt-2 pt-2 border-t border-zinc-800/60 flex justify-between items-center">
                                    <span className="text-zinc-500">Payment Proof:</span>
                                    <a
                                      href={req.receiptUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-green-500 hover:text-green-400 font-bold flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20"
                                    >
                                      <i className="fa-solid fa-circle-check"></i>
                                      <span>View Receipt Proof</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                              <span className="text-[9px] text-zinc-600 block self-end">
                                {new Date(req.timestamp).toLocaleString()}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </main>
      )}

    </div>
  );
}
