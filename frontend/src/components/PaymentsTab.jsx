'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';

export default function PaymentsTab() {
  const { userAddress, jwtToken, userProfile, provider, signer, loadProfile } = useWeb3();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [proxyAddress, setProxyAddress] = useState(null);
  const [custodianBalance, setCustodianBalance] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const CUSTODY_WALLET_ADDRESS = "0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17";

  const loadLedgerAndProxy = async () => {
    if (!jwtToken || !userAddress) return;
    try {
      // 1. Fetch balance & transactions from Next.js API
      const balanceRes = await fetch(`/api/ledger/balance`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const balanceData = await balanceRes.json();
      setBalance(balanceData.balance || 0);
      setTransactions(balanceData.transactions || []);
      
      if (userProfile && userProfile.proxyAddress) {
        setProxyAddress(userProfile.proxyAddress);
      }
      // Custody on-chain balance: removed to avoid RPC rate limiting
    } catch (err) {
      console.error("Failed to load ledger/proxy details:", err);
    }
  };

  useEffect(() => {
    loadLedgerAndProxy();
    // Poll ledger every 4 seconds
    const interval = setInterval(loadLedgerAndProxy, 30000); // 30s — avoid RPC spam
    return () => clearInterval(interval);
  }, [jwtToken, userAddress, userProfile, provider]);

  const handleCreateProxy = async () => {
    if (!signer) return;
    try {
      setLoading(true);
      alert("Generating your private utility wallet...");
      
      // Load Factory Address
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
        alert("Proxy wallet deployed and profile updated successfully!");
      } else {
        throw new Error("Could not retrieve proxy address from transaction logs.");
      }
    } catch (err) {
      console.error("Factory deploy failed:", err);
      alert(err.reason || err.message || "Factory deployment failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDepositProxy = async () => {
    if (!signer || !proxyAddress) return;
    const amount = parseFloat(depositAmount) || 0;
    if (amount <= 0) {
      alert("Enter a positive deposit amount!");
      return;
    }
    
    try {
      setLoading(true);
      alert(`Initiating direct deposit of ${amount} ARES to proxy ${proxyAddress}...`);
      const tx = await signer.sendTransaction({
        to: proxyAddress,
        value: ethers.parseEther(amount.toString())
      });
      await tx.wait();
      alert(`Successfully deposited ${amount} ARES! The sweeper daemon will credit your ledger balance shortly.`);
      setDepositAmount('');
      loadLedgerAndProxy();
    } catch (err) {
      console.error("Proxy deposit failed:", err);
      alert(err.message || "Deposit failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!recipient || !transferAmount) {
      alert("Recipient and amount are required!");
      return;
    }
    
    try {
      setLoading(true);
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
        alert(`Successfully sent utility credit! Net received: ${data.netAmount.toFixed(2)} ARES (5% fee deducted).`);
        setRecipient('');
        setTransferAmount('');
        loadLedgerAndProxy();
      } else {
        alert(data.error || "Transfer failed.");
      }
    } catch (err) {
      console.error("Transfer failed:", err);
      alert("Transfer failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Address copied!");
  };

  const formattedProxy = proxyAddress 
    ? `${proxyAddress.substring(0, 6)}...${proxyAddress.substring(proxyAddress.length - 4)}`
    : '';

  const formattedCustody = `${CUSTODY_WALLET_ADDRESS.substring(0, 6)}...${CUSTODY_WALLET_ADDRESS.substring(CUSTODY_WALLET_ADDRESS.length - 4)}`;

  // Preview transfer details
  const amount = parseFloat(transferAmount) || 0;
  const transferFee = amount * 0.05;
  const netReceived = Math.max(0, amount - transferFee);

  return (
    <div className="grid-layout">
      {/* Left Column: Proxy wallet & internal transfer */}
      <div className="main-column">
        {/* Proxy wallet details */}
        <div className="revolut-card">
          <h3 className="card-title">Utility Portal Account Wallet</h3>
          <p className="card-desc">Your unique EIP-1167 proxy wallet. Funds sent here are automatically routed to the admin custody address and credited to your utility portal balance.</p>

          {!proxyAddress ? (
            <div className="proxy-state-box" id="proxy-unregistered-box">
              <i className="fa-solid fa-wallet" style={{ fontSize: '2.5rem', color: '#1a1c24', marginBottom: '1rem' }}></i>
              <h4>No Utility Wallet Found</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Register on the utility portal to generate your unique blockchain deposit address.</p>
              <button className="btn-primary" onClick={handleCreateProxy} disabled={loading}>
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Create Utility Address'}
              </button>
            </div>
          ) : (
            <div className="proxy-state-box" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
              <div className="form-group" style={{ width: '100%' }}>
                <label>Your Unique Deposit Address</label>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <input type="text" value={proxyAddress} readOnly style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', padding: '0.75rem' }} />
                  <button className="btn-secondary" style={{ flex: '0 0 44px', padding: 0 }} title="Copy address" onClick={() => copyToClipboard(proxyAddress)}>
                    <i className="fa-solid fa-copy"></i>
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ width: '100%' }}>
                <label htmlFor="deposit-proxy-amount">Send direct deposit to test auto-forwarding</label>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <input 
                    type="number" 
                    id="deposit-proxy-amount" 
                    placeholder="Amount (ARES)" 
                    min="1" 
                    step="1" 
                    style={{ flex: 1 }}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                  <button className="btn-primary" style={{ flex: '0 0 130px' }} onClick={handleDepositProxy} disabled={loading}>
                    {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Deposit ARES'}
                  </button>
                </div>
              </div>

              {/* Forwarding flow diagram */}
              <div className="transfer-visualizer-card" style={{ width: '100%' }}>
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.5px' }}>Auto-Routing Flow</h4>
                <div className="visualizer-nodes">
                  <div className="v-node">
                    <span className="node-label">Your Proxy</span>
                    <span className="node-address" title={proxyAddress}>{formattedProxy}</span>
                  </div>
                  <div className="v-arrow">
                    <i className="fa-solid fa-angles-right"></i>
                  </div>
                  <div className="v-node">
                    <span className="node-label">Admin Custodial</span>
                    <span className="node-address" title={CUSTODY_WALLET_ADDRESS}>{formattedCustody}</span>
                  </div>
                </div>
                <div className="v-caption">
                  Custodial Account Balance: {custodianBalance.toFixed(2)} ARES
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Send utility card */}
        {proxyAddress ? (
          <div className="revolut-card" id="internal-transfer-card">
            <h3 className="card-title">Send Utility Credit</h3>
            <p className="card-desc">Transfer available utility portal balance to another user instantly. A 5.0% fee is deducted from the transfer amount.</p>
            
            <div className="form-group">
              <label htmlFor="transfer-recipient">Recipient Address (MetaMask or Proxy)</label>
              <input 
                type="text" 
                id="transfer-recipient" 
                placeholder="Enter 0x... address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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
                />
                <span className="input-suffix">ARES</span>
              </div>
              <small className="helper-text" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.4rem', display: 'block' }}>
                Deducts 5% fee: {transferFee.toFixed(2)} ARES. Recipient receives: {netReceived.toFixed(2)} ARES.
              </small>
            </div>

            <button className="btn-primary" onClick={handleTransfer} disabled={loading}>
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Send Instantly'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Right Column: Ledger transactions list */}
      <div className="side-column">
        <div className="revolut-card">
          <h3 className="card-title">Utility Credit & Transactions</h3>
          <p className="card-desc">Track your utility portal balance and recent splits or deposits.</p>

          <div className="utility-balance-box">
            <div className="u-label">Available Utility Balance</div>
            <div className="u-amount">{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="currency-sub">ARES</span></div>
          </div>

          <h4 style={{ margin: '1.5rem 0 0.75rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Transaction History</h4>
          <div className="tx-history-list">
            {transactions.length === 0 ? (
              <div className="tx-item-empty">No transactions yet.</div>
            ) : (
              transactions.map(tx => {
                const isReceived = tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' || tx.type === 'CLAIM_DIRECT';
                const amtStr = isReceived ? `+${tx.netAmount.toFixed(2)} ARES` : `-${tx.amount.toFixed(2)} ARES`;
                const amtClass = isReceived ? "tx-amount in" : "tx-amount out";
                
                return (
                  <div className="tx-item" key={tx.id}>
                    <div className="tx-item-left">
                      <span className="tx-type">{tx.type}</span>
                      <span className="tx-time" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {tx.description} • {new Date(tx.timestamp).toLocaleString()}
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
  );
}
