'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';
import { waitForTransactionReceiptWithRetry } from '../lib/txWaiter';

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

  const CUSTODY_WALLET_ADDRESS = "0xD01c1BFC96E22A9470C186E69E0A97e18EfF23e6";

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
        value: ethers.parseEther(amount.toString()),
        gasPrice: ethers.parseUnits("1.5", "gwei")
      });
      await waitForTransactionReceiptWithRetry(signer.provider || provider, tx.hash);
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
        {/* LEFT: Proxy wallet + Send utility */}
        <div className="flex flex-col gap-6">
          {/* Utility Portal Account Wallet Card */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Your Wallet</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Utility Portal Account Wallet</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Your unique EIP-1167 proxy wallet. Funds sent here are automatically routed to the admin custody address and credited to your utility portal balance.</p>

            {!proxyAddress ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
                  <i className="fa-solid fa-wallet text-zinc-500 text-xl" />
                </div>
                <h4 className="text-white font-bold mb-2">No Utility Wallet Found</h4>
                <p className="text-sm text-zinc-500 mb-6 max-w-xs mx-auto">Register on the utility portal to generate your unique blockchain deposit address.</p>
                <button className="px-6 py-2.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-100 transition-all" onClick={handleCreateProxy} disabled={loading}>
                  {loading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Create Utility Address'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Your Unique Deposit Address</label>
                  <div className="flex gap-2">
                    <input type="text" value={proxyAddress} readOnly className="flex-1 min-w-0 bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-zinc-400 text-xs font-mono focus:outline-none" />
                    <button className="w-11 h-11 flex items-center justify-center bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/60 rounded-xl text-zinc-300 hover:text-white transition-all text-sm" title="Copy address" onClick={() => copyToClipboard(proxyAddress)}>
                      <i className="fa-solid fa-copy text-xs" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Send Direct Deposit</label>
                  <div className="flex gap-2">
                    <input type="number" id="deposit-proxy-amount" placeholder="Amount (ARES)" min="1" step="1" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="flex-1 bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 placeholder-zinc-600" />
                    <button className="px-5 py-3 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-100 transition-all flex-shrink-0" onClick={handleDepositProxy} disabled={loading}>
                      {loading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Deposit'}
                    </button>
                  </div>
                </div>
                <div className="bg-zinc-950/40 rounded-xl border border-zinc-800/30 p-4">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-3">Auto-Routing Flow</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-zinc-900/60 rounded-lg p-3 text-center border border-zinc-800/30">
                      <div className="text-[10px] text-zinc-500 mb-1">Your Proxy</div>
                      <div className="text-xs font-mono text-zinc-300">{formattedProxy}</div>
                    </div>
                    <i className="fa-solid fa-angles-right text-zinc-600" />
                    <div className="flex-1 bg-zinc-900/60 rounded-lg p-3 text-center border border-zinc-800/30">
                      <div className="text-[10px] text-zinc-500 mb-1">Admin Custodial</div>
                      <div className="text-xs font-mono text-zinc-300">{formattedCustody}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-2 text-center">Balance: {custodianBalance.toFixed(2)} ARES</div>
                </div>
              </div>
            )}
          </div>

          {/* Send Utility Credit - only if proxyAddress */}
          {proxyAddress ? (
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Transfer</div>
              <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Send Utility Credit</h2>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Transfer available utility portal balance to another user instantly. A 5.0% fee is deducted from the transfer amount.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Recipient Address</label>
                  <input type="text" id="transfer-recipient" placeholder="Enter 0x... address" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 placeholder-zinc-600 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Amount to Send</label>
                  <div className="relative">
                    <input type="number" id="transfer-amount" placeholder="Amount (ARES)" min="1" step="1" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3.5 pr-16 text-white text-sm focus:outline-none focus:border-zinc-600 placeholder-zinc-600 transition-all" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">ARES</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-2">5% fee: {transferFee.toFixed(2)} ARES. Recipient receives: {netReceived.toFixed(2)} ARES.</p>
                </div>
                <button className="w-full py-3.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2" onClick={handleTransfer} disabled={loading}>
                  {loading ? <><i className="fa-solid fa-spinner fa-spin" /> Processing...</> : '⚡ Send Instantly'}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* RIGHT: Ledger & transactions */}
        <div>
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Balance</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-6">Utility Credit &amp; Transactions</h2>

            {/* Balance display */}
            <div className="bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-5 mb-6 text-center">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Available Utility Balance</div>
              <div className="text-3xl font-black text-white tracking-tight">{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-zinc-500 font-mono mt-1">ARES</div>
            </div>

            {/* Transaction history */}
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Transaction History</div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {transactions.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 text-sm">No transactions yet.</div>
              ) : (
                transactions.map(tx => {
                  const isReceived = tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' || tx.type === 'CLAIM_DIRECT';
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800/30 hover:border-zinc-800/60 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">{tx.type}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{tx.description} • {new Date(tx.timestamp).toLocaleString()}</div>
                      </div>
                      <span className={`text-xs font-black font-mono ml-3 flex-shrink-0 ${isReceived ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isReceived ? '+' : '-'}{isReceived ? tx.netAmount?.toFixed(2) : tx.amount?.toFixed(2)} ARES
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
