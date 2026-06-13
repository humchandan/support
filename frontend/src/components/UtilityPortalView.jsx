'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';

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

export default function UtilityPortalView() {
  const { userAddress, jwtToken, userProfile, provider, signer, disconnectWallet, loadProfile } = useWeb3();
  const router = useRouter();

  // Ledger state
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [proxyAddress, setProxyAddress] = useState(null);
  const [custodianBalance, setCustodianBalance] = useState(0);
  
  // Spend form states
  const [selectedService, setSelectedService] = useState('mobile'); // 'mobile' | 'electricity' | 'internet' | 'voucher'
  const [phoneNo, setPhoneNo] = useState('');
  const [operator, setOperator] = useState('Aries Mobile');
  const [billId, setBillId] = useState('');
  const [billProvider, setBillProvider] = useState('Aries Power');
  const [internetAcc, setInternetAcc] = useState('');
  const [internetIsp, setInternetIsp] = useState('Aries Fiber');
  const [voucherBrand, setVoucherBrand] = useState('Amazon Gift Card');
  
  const [spendAmount, setSpendAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // Toast alert state
  const [toast, setToast] = useState({ message: '', show: false, isError: false });

  const showToast = (message, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const CUSTODY_WALLET_ADDRESS = "0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17";

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

  useEffect(() => {
    loadLedgerAndProxy();
    const interval = setInterval(loadLedgerAndProxy, 30000); // 30s — avoid RPC spam
    return () => clearInterval(interval);
  }, [jwtToken, userAddress, userProfile, provider]);

  const handleCreateProxy = async () => {
    if (!signer) return;
    try {
      setLoading(true);
      showToast("Generating your private utility wallet...", false);

      const supportResponse = await fetch("/contracts/PortalFactory.json");
      const supportData = await supportResponse.json();
      const factoryContract = new ethers.Contract(supportData.address, supportData.abi, signer);
      
      const userId = ethers.keccak256(ethers.toUtf8Bytes("portal_user_" + userAddress.toLowerCase()));
      
      const tx = await factoryContract.createPortal(userId);
      const receipt = await tx.wait();
      
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
        value: ethers.parseEther(amount.toString())
      });
      await tx.wait();
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

    let description = '';
    if (selectedService === 'mobile') {
      if (!phoneNo) { showToast("Enter mobile number!", true); return; }
      description = `Mobile Top-up (${operator}) to ${phoneNo}`;
    } else if (selectedService === 'electricity') {
      if (!billId) { showToast("Enter account ID!", true); return; }
      description = `Utility Bill (${billProvider}) ID: ${billId}`;
    } else if (selectedService === 'internet') {
      if (!internetAcc) { showToast("Enter internet username/ID!", true); return; }
      description = `Broadband payment (${internetIsp}) for ${internetAcc}`;
    } else if (selectedService === 'voucher') {
      description = `E-Voucher (${voucherBrand}) purchase`;
    }

    try {
      setLoading(true);
      showToast("Processing utility payment transaction...", false);

      const res = await fetch(`/api/ledger/spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ amount, description })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Utility payment successful! ${amount} ARES deducted.`, false);
        setSpendAmount('');
        setPhoneNo('');
        setBillId('');
        setInternetAcc('');
        loadLedgerAndProxy();
      } else {
        showToast(data.error || "Payment failed.", true);
      }
    } catch (err) {
      console.error("Spend transaction failed:", err);
      showToast("Payment execution failed.", true);
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
            <div className="brand-logo">
              Aries<span className="dot">.</span>
            </div>
            
            {/* Header Navigation Tab Buttons */}
            <nav className="hidden sm:flex items-center gap-4 text-sm font-semibold">
              <button 
                onClick={() => router.push('/app')}
                className="text-zinc-400 hover:text-white px-3 py-1.5 transition-colors"
              >
                <i className="fa-solid fa-sitemap mr-1.5"></i> MLM Dashboard
              </button>
              <button 
                className="text-white bg-[#252836] rounded-full px-4 py-1.5 transition-colors cursor-default"
              >
                <i className="fa-solid fa-wallet mr-1.5"></i> Utility Portal
              </button>
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
              <p className="card-desc">Simulate spending your available off-chain ledger credit balance directly on bills, mobile recharges, and shopping vouchers.</p>
              
              {/* Category Segmented Tabs */}
              <div className="grid grid-cols-4 gap-2 bg-[#16171e] p-1.5 rounded-xl mb-6">
                <button 
                  type="button"
                  onClick={() => setSelectedService('mobile')}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${selectedService === 'mobile' ? 'bg-[#252836] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <i className="fa-solid fa-mobile-screen"></i>
                  <span className="hidden sm:inline">Mobile</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedService('electricity')}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${selectedService === 'electricity' ? 'bg-[#252836] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <i className="fa-solid fa-lightbulb"></i>
                  <span className="hidden sm:inline">Bills</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedService('internet')}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${selectedService === 'internet' ? 'bg-[#252836] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <i className="fa-solid fa-wifi"></i>
                  <span className="hidden sm:inline">Broadband</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedService('voucher')}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${selectedService === 'voucher' ? 'bg-[#252836] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <i className="fa-solid fa-gift"></i>
                  <span className="hidden sm:inline">Vouchers</span>
                </button>
              </div>

              {/* Spend execution Form */}
              <form onSubmit={handleSpend} className="space-y-4 text-left">
                {selectedService === 'mobile' && (
                  <>
                    <div className="form-group mb-0">
                      <label htmlFor="spend-mobile-op">Mobile Operator</label>
                      <select 
                        id="spend-mobile-op"
                        value={operator}
                        onChange={(e) => setOperator(e.target.value)}
                        className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white"
                      >
                        <option value="Aries Mobile">Aries Mobile LTE</option>
                        <option value="Aries Connect">Aries Connect 5G</option>
                        <option value="Aries Link">Aries Link Pre-Paid</option>
                      </select>
                    </div>
                    <div className="form-group mb-0">
                      <label htmlFor="spend-mobile-phone">Phone Number</label>
                      <input 
                        type="text" 
                        id="spend-mobile-phone"
                        placeholder="e.g. +1 (555) 0199"
                        value={phoneNo}
                        onChange={(e) => setPhoneNo(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {selectedService === 'electricity' && (
                  <>
                    <div className="form-group mb-0">
                      <label htmlFor="spend-bill-prov">Bill Utility Provider</label>
                      <select 
                        id="spend-bill-prov"
                        value={billProvider}
                        onChange={(e) => setBillProvider(e.target.value)}
                        className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white"
                      >
                        <option value="Aries Power">Aries Power &amp; Electricity</option>
                        <option value="Aries Gas">Aries Gas Corporation</option>
                        <option value="Aries Water">Aries Water Supply</option>
                      </select>
                    </div>
                    <div className="form-group mb-0">
                      <label htmlFor="spend-bill-id">Customer Account ID</label>
                      <input 
                        type="text" 
                        id="spend-bill-id"
                        placeholder="e.g. ELEC-992011"
                        value={billId}
                        onChange={(e) => setBillId(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {selectedService === 'internet' && (
                  <>
                    <div className="form-group mb-0">
                      <label htmlFor="spend-internet-isp">Broadband ISP Provider</label>
                      <select 
                        id="spend-internet-isp"
                        value={internetIsp}
                        onChange={(e) => setInternetIsp(e.target.value)}
                        className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white"
                      >
                        <option value="Aries Fiber">Aries Fiber optic</option>
                        <option value="Aries Broadband">Aries Satellite Broadband</option>
                      </select>
                    </div>
                    <div className="form-group mb-0">
                      <label htmlFor="spend-internet-acc">Internet User account ID</label>
                      <input 
                        type="text" 
                        id="spend-internet-acc"
                        placeholder="e.g. user@ariesfiber"
                        value={internetAcc}
                        onChange={(e) => setInternetAcc(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {selectedService === 'voucher' && (
                  <div className="form-group mb-0">
                    <label htmlFor="spend-voucher-brand">Select Shopping Brand E-Voucher</label>
                    <select 
                      id="spend-voucher-brand"
                      value={voucherBrand}
                      onChange={(e) => setVoucherBrand(e.target.value)}
                      className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white"
                    >
                      <option value="Amazon Gift Card">Amazon Gift Card (Universal)</option>
                      <option value="Google Play Voucher">Google Play Store Card</option>
                      <option value="Apple Vouchers">Apple Gift &amp; Services Card</option>
                      <option value="Decentralized Vouchers">Web3 Node Services Voucher</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="spend-amount">Payment Amount</label>
                  <div className="input-container">
                    <input 
                      type="number" 
                      id="spend-amount"
                      placeholder="Amount in ARES" 
                      min="1" 
                      step="1"
                      value={spendAmount}
                      onChange={(e) => setSpendAmount(e.target.value)}
                    />
                    <span className="input-suffix">ARES</span>
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Pay Bills / Buy Voucher'}
                </button>
              </form>
            </div>

            {/* Utility Wallet Details */}
            <div className="revolut-card">
              <h3 className="card-title">Account Gateway Wallet</h3>
              <p className="card-desc">Funds sent to this unique EIP-1167 proxy wallet are automatically routed to the custodial treasury and credited to your available utility balance.</p>

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
                    <label htmlFor="deposit-amount">Simulate Deposit (Test auto-sweep forwarding)</label>
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

                  {/* Flow Diagram */}
                  <div className="transfer-visualizer-card !mt-2">
                    <h4 className="text-xs uppercase text-zinc-500 tracking-wider mb-4 font-semibold">Auto-Routing Flow</h4>
                    <div className="visualizer-nodes">
                      <div className="v-node">
                        <span className="node-label">Your Proxy</span>
                        <span className="node-address" title={proxyAddress}>{formattedProxy}</span>
                      </div>
                      <div className="v-arrow">
                        <i className="fa-solid fa-angles-right text-blue-500"></i>
                      </div>
                      <div className="v-node">
                        <span className="node-label">Admin Custodial</span>
                        <span className="node-address" title={CUSTODY_WALLET_ADDRESS}>{formattedCustody}</span>
                      </div>
                    </div>
                    <div className="v-caption">
                      Custodial Wallet Balance: {custodianBalance.toFixed(2)} ARES
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Send Utility Credit (Internal Transfer) */}
            {proxyAddress && (
              <div className="revolut-card" id="internal-transfer-card">
                <h3 className="card-title">Send Utility Credit (Internal)</h3>
                <p className="card-desc">Transfer available utility portal balance to another user's utility wallet instantly. A 5.0% fee is deducted. Transfers to unregistered external wallets are automatically rejected.</p>
                
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
                        Deducts 5% fee: {(parseFloat(transferAmount) * 0.05).toFixed(2)} ARES. Recipient receives: {(parseFloat(transferAmount) * 0.95).toFixed(2)} ARES.
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

          {/* Right Column: Ledger Transaction History log */}
          <div className="side-column">
            <div className="revolut-card">
              <h3 className="card-title">Transaction Ledger</h3>
              <p className="card-desc">Full history of claims, deposits, internal transfers, and spend recharges for this wallet address.</p>
              
              <div className="tx-history-list text-left">
                {transactions.length === 0 ? (
                  <div className="tx-item-empty">No transactions logged yet.</div>
                ) : (
                  transactions.map(tx => {
                    const isReceived = tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' || tx.type === 'CLAIM_DIRECT';
                    const amtStr = isReceived ? `+${tx.netAmount.toFixed(2)} ARES` : `-${tx.amount.toFixed(2)} ARES`;
                    const amtClass = isReceived ? "tx-amount in !text-emerald-400" : "tx-amount out !text-zinc-400";
                    
                    return (
                      <div className="tx-item" key={tx.id}>
                        <div className="tx-item-left">
                          <span className="tx-type text-white font-semibold flex items-center gap-1.5">
                            {tx.type === 'SPEND' ? (
                              <i className="fa-solid fa-cart-shopping text-blue-400 text-xs"></i>
                            ) : isReceived ? (
                              <i className="fa-solid fa-arrow-down-long text-emerald-400 text-xs"></i>
                            ) : (
                              <i className="fa-solid fa-arrow-up-long text-zinc-400 text-xs"></i>
                            )}
                            {tx.type}
                          </span>
                          <span className="tx-time text-zinc-500">
                            {tx.description}
                          </span>
                          <span className="text-[10px] text-zinc-600">
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
          </div>

        </div>

      </main>

    </div>
  );
}
