'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { ethers } from 'ethers';
import { waitForTransactionReceiptWithRetry } from '../lib/txWaiter';
import { BackgroundGradient } from './ui/background-gradient';
import { motion, AnimatePresence } from 'framer-motion';

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

  const Section = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-purple-500/20 hover:bg-[#111113]/90 hover:shadow-[0_4px_30px_-4px_rgba(168,85,247,0.1)] ${className}`}>
      {children}
    </div>
  );

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] font-bold text-purple-400 uppercase tracking-[0.15em] mb-1.5 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]"></div>
      {children}
    </div>
  );

  const SectionTitle = ({ children, icon }: { children: React.ReactNode; icon?: string }) => (
    <h2 className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight mb-1 flex items-center gap-2">
      {icon && <span className="text-base opacity-90 drop-shadow-md">{icon}</span>}
      {children}
    </h2>
  );

  const SectionDesc = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[13px] text-zinc-400 leading-relaxed mb-6 font-medium">{children}</p>
  );

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Utility Portal Account Wallet Card */}
          <Section className="relative overflow-hidden">
            <SectionLabel>Your Wallet</SectionLabel>
            <SectionTitle>Utility Portal Account Wallet</SectionTitle>
            <SectionDesc>Your unique EIP-1167 proxy wallet. Funds sent here are automatically routed to the admin custody address and credited to your utility portal balance.</SectionDesc>

            {!proxyAddress ? (
              <div className="text-center py-10 bg-[#0c0c0e] border border-[#1a1a1e] rounded-xl mt-2">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#111113] border border-[#1e1e22] flex items-center justify-center">
                  <i className="fa-solid fa-wallet text-[#6e6e80] text-lg" />
                </div>
                <h4 className="text-[15px] text-white font-semibold mb-1.5">No Utility Wallet Found</h4>
                <p className="text-[12px] text-[#8e8ea0] mb-6 max-w-xs mx-auto px-4">Register on the utility portal to generate your unique blockchain deposit address.</p>
                <button 
                  className="px-6 py-2.5 bg-white text-black font-semibold rounded-xl text-sm hover:bg-[#e4e4e7] transition-all disabled:opacity-40" 
                  onClick={handleCreateProxy} 
                  disabled={loading}
                >
                  {loading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Create Utility Address'}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e6e80] mb-2 uppercase tracking-wide">Your Unique Deposit Address</label>
                  <div className="flex gap-2">
                    <input type="text" value={proxyAddress} readOnly className="flex-1 min-w-0 bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3 text-[#8e8ea0] text-xs font-mono focus:outline-none" />
                    <button className="w-11 h-11 flex items-center justify-center bg-[#0c0c0e] hover:bg-[#1a1a1e] border border-[#1e1e22] rounded-xl text-[#6e6e80] hover:text-white transition-all text-sm" title="Copy address" onClick={() => copyToClipboard(proxyAddress)}>
                      <i className="fa-solid fa-copy text-xs" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e6e80] mb-2 uppercase tracking-wide">Send Direct Deposit</label>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Amount (ARES)" min="1" step="1" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="flex-1 bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3 text-white text-[13px] focus:outline-none focus:border-[#3a3a42] placeholder-[#4e4e5c]" />
                    <button className="px-5 py-3 bg-white text-black font-semibold rounded-xl text-[13px] hover:bg-[#e4e4e7] transition-all flex-shrink-0 disabled:opacity-40" onClick={handleDepositProxy} disabled={loading}>
                      {loading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Deposit'}
                    </button>
                  </div>
                </div>
                <div className="bg-[#0c0c0e] rounded-xl border border-[#1a1a1e] p-4 mt-2">
                  <div className="text-[10px] font-semibold text-[#6e6e80] uppercase tracking-wide mb-3">Auto-Routing Flow</div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <div className="flex-1 bg-[#111113] rounded-lg p-3 text-center border border-[#1e1e22]">
                      <div className="text-[10px] text-[#6e6e80] mb-1 font-medium">Your Proxy</div>
                      <div className="text-xs font-mono text-[#8e8ea0]">{formattedProxy}</div>
                    </div>
                    <i className="fa-solid fa-angles-right text-[#4e4e5c] text-xs" />
                    <div className="flex-1 bg-[#111113] rounded-lg p-3 text-center border border-[#1e1e22]">
                      <div className="text-[10px] text-[#6e6e80] mb-1 font-medium">Admin Custodial</div>
                      <div className="text-xs font-mono text-[#8e8ea0]">{formattedCustody}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#6e6e80] mt-3 text-center font-medium">Balance: <span className="text-white">{custodianBalance.toFixed(2)}</span> ARES</div>
                </div>
              </div>
            )}
          </Section>

          {/* Send Utility Credit - only if proxyAddress */}
          {proxyAddress && (
            <Section>
              <SectionLabel>Transfer</SectionLabel>
              <SectionTitle>Send Utility Credit</SectionTitle>
              <SectionDesc>Send ARES from your proxy balance directly to another user's wallet. A 5% network transfer fee applies.</SectionDesc>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e6e80] mb-2 uppercase tracking-wide">Recipient Address</label>
                  <input type="text" placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3 text-white text-[13px] font-mono focus:outline-none focus:border-[#3a3a42] placeholder-[#4e4e5c]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6e6e80] mb-2 uppercase tracking-wide">Amount (ARES)</label>
                  <input type="number" placeholder="0.0" min="0" step="1" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3 text-white text-[13px] focus:outline-none focus:border-[#3a3a42] placeholder-[#4e4e5c]" />
                </div>
                
                {amount > 0 && (
                  <div className="bg-[#0c0c0e] rounded-xl p-3 border border-[#1a1a1e] space-y-1.5 my-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6e6e80]">Transfer Amount:</span>
                      <span className="text-[#8e8ea0]">{amount.toFixed(2)} ARES</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6e6e80]">Network Fee (5%):</span>
                      <span className="text-red-400">-{transferFee.toFixed(2)} ARES</span>
                    </div>
                    <div className="h-px bg-[#1e1e22] my-1" />
                    <div className="flex justify-between text-[12px] font-bold">
                      <span className="text-[#8e8ea0]">Recipient Gets:</span>
                      <span className="text-emerald-400">{netReceived.toFixed(2)} ARES</span>
                    </div>
                  </div>
                )}

                <button className="w-full py-3 mt-2 bg-white text-black font-semibold rounded-xl text-[13px] hover:bg-[#e4e4e7] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2" onClick={handleTransfer} disabled={loading || amount <= 0 || !recipient}>
                  {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-regular fa-paper-plane" /> Send Funds</>}
                </button>
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5">
          
          <Section>
            <SectionLabel>Balance</SectionLabel>
            <SectionTitle>Available Credits</SectionTitle>
            
            <div className="bg-[#0c0c0e] border border-[#1a1a1e] rounded-xl p-5 mb-6 text-center">
              <div className="text-[10px] font-semibold text-[#6e6e80] uppercase tracking-wide mb-2">Available Utility Balance</div>
              <div className="text-3xl font-semibold text-white tracking-tight font-mono">{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-[12px] text-[#6e6e80] mt-1">ARES</div>
            </div>

            <SectionLabel>History</SectionLabel>
            <div className="text-[14px] font-semibold text-white mb-3">Transaction History</div>
            
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {transactions.length === 0 ? (
                <div className="py-8 text-center text-[#4e4e5c] text-[13px] border border-dashed border-[#1e1e22] rounded-xl">No transactions yet.</div>
              ) : (
                <AnimatePresence>
                  {transactions.map((tx, idx) => {
                    const isReceived = tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' || tx.type === 'CLAIM_DIRECT';
                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                        className="flex items-center justify-between p-3.5 bg-[#0c0c0e] rounded-xl border border-[#1a1a1e] hover:border-[#2a2a30] transition-colors group"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="text-[11px] font-bold text-white mb-1">{tx.type}</div>
                          <div className="text-[10px] text-[#6e6e80] truncate">{tx.description}</div>
                          <div className="text-[9px] text-[#4e4e5c] mt-0.5">{new Date(tx.timestamp).toLocaleString()}</div>
                        </div>
                        <span className={`text-[12px] font-semibold font-mono flex-shrink-0 px-2.5 py-1 rounded-md bg-[#111113] border border-[#1e1e22] ${isReceived ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isReceived ? '+' : '-'}{isReceived ? tx.netAmount?.toFixed(2) : tx.amount?.toFixed(2)}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
