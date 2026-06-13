'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';

const ADMIN_ADDRESSES = [
  '0x963ebdf2e1f8db8707d05fc75bfeffba1b5bac17'
];

export default function AdminView() {
  const { userAddress, jwtToken, provider } = useWeb3();
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'mlm' | 'catalog'
  
  // Data States
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mlmTiers, setMlmTiers] = useState([]);
  const [mlmLevels, setMlmLevels] = useState([]);
  
  // Loading & Alert States
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', show: false, isError: false });
  
  // Action Modals & Form States
  const [actionNotes, setActionNotes] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  // Catalog Form States
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('fa-star');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcDesc, setNewSvcDesc] = useState('');
  const [newSvcMin, setNewSvcMin] = useState('1');
  const [newSvcMax, setNewSvcMax] = useState('1000');
  const [editingService, setEditingService] = useState(null);

  // Dynamic fields builder state
  const [svcFields, setSvcFields] = useState([]);
  const [tempFieldName, setTempFieldName] = useState('');
  const [tempFieldLabel, setTempFieldLabel] = useState('');
  const [tempFieldType, setTempFieldType] = useState('text');
  const [tempFieldPlaceholder, setTempFieldPlaceholder] = useState('');

  const showToast = (message, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const isAdminAddress = userAddress && ADMIN_ADDRESSES.includes(userAddress.toLowerCase());

  // ── LOAD DATA ──────────────────────────────────────────────────────────────
  const loadRequests = async () => {
    if (!jwtToken) return;
    try {
      const res = await fetch('/api/admin/utility/requests', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (res.ok) setRequests(data.requests || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMlmConfig = async () => {
    if (!jwtToken) return;
    try {
      const res = await fetch('/api/admin/config', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMlmTiers(data.tiers || []);
        setMlmLevels(data.levels || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadCatalog = async () => {
    if (!jwtToken) return;
    try {
      const res = await fetch('/api/admin/utility/categories', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories || []);
        if (data.categories?.length > 0 && !selectedCategory) {
          setSelectedCategory(data.categories[0]);
        } else if (selectedCategory) {
          // Sync selected category if it was updated
          const updated = data.categories.find(c => c.id === selectedCategory.id);
          if (updated) setSelectedCategory(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (jwtToken && isAdminAddress) {
      loadRequests();
      loadMlmConfig();
      loadCatalog();
    }
  }, [jwtToken, userAddress]);

  // ── REQUEST APPROVALS ─────────────────────────────────────────────────────
  const handleApproveRequest = async () => {
    if (!selectedRequest) return;
    try {
      setLoading(true);
      showToast("Approving utility request and updating ledger...", false);
      const res = await fetch('/api/admin/utility/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: 'APPROVED',
          adminNotes: actionNotes || 'Processed successfully by admin',
          receiptUrl
        })
      });
      if (res.ok) {
        showToast("Request approved successfully!", false);
        setShowApproveModal(false);
        setActionNotes('');
        setReceiptUrl('');
        setSelectedRequest(null);
        loadRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to approve request", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingReceipt(true);
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
        setReceiptUrl(data.url);
        showToast("Receipt uploaded successfully!", false);
      } else {
        showToast(data.error || "Upload failed", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Receipt upload failed.", true);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;
    try {
      setLoading(true);
      showToast("Rejecting request and issuing ARES refund...", false);
      const res = await fetch('/api/admin/utility/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ requestId: selectedRequest.id, status: 'REJECTED', adminNotes: actionNotes })
      });
      if (res.ok) {
        showToast("Request rejected. Credits refunded to user ledger.", false);
        setShowRejectModal(false);
        setActionNotes('');
        setSelectedRequest(null);
        loadRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to reject request", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic custom fields builder helpers
  const handleAddSvcField = () => {
    if (!tempFieldName || !tempFieldLabel) {
      showToast("Field Key and Field Label are required!", true);
      return;
    }
    const cleanKey = tempFieldName.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (svcFields.some(f => f.name === cleanKey)) {
      showToast("A field with this Key already exists!", true);
      return;
    }
    setSvcFields(prev => [...prev, {
      name: cleanKey,
      label: tempFieldLabel.trim(),
      type: tempFieldType,
      placeholder: tempFieldPlaceholder.trim()
    }]);
    setTempFieldName('');
    setTempFieldLabel('');
    setTempFieldType('text');
    setTempFieldPlaceholder('');
  };

  const handleRemoveSvcField = (name) => {
    setSvcFields(prev => prev.filter(f => f.name !== name));
  };

  // ── MLM CONFIGS ───────────────────────────────────────────────────────────
  const handleUpdateTier = async (tier) => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ type: 'tier', ...tier })
      });
      if (res.ok) {
        showToast(`MLM Tier '${tier.name}' updated successfully!`, false);
        loadMlmConfig();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to update tier settings", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLevel = async (lvl) => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ type: 'level', ...lvl })
      });
      if (res.ok) {
        showToast(`Referral Level ${lvl.level} percentage updated!`, false);
        loadMlmConfig();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to update level percentage", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  // ── CATEGORIES & SERVICES CATALOG ─────────────────────────────────────────
  const handleSaveCategory = async () => {
    if (!newCatName) return;
    try {
      setLoading(true);
      const isEditing = !!editingCategory;
      const url = '/api/admin/utility/categories';
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing ? { id: editingCategory.id, name: newCatName, icon: newCatIcon } : { name: newCatName, icon: newCatIcon };
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast(isEditing ? "Category updated!" : "Category created successfully!", false);
        setNewCatName('');
        setNewCatIcon('fa-star');
        setEditingCategory(null);
        await loadCatalog();
      } else {
        const data = await res.json();
        showToast(data.error || "Category action failed", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm("Are you sure you want to delete this category? All child services will be deleted!")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/utility/categories?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (res.ok) {
        showToast("Category deleted successfully!", false);
        if (selectedCategory?.id === id) {
          setSelectedCategory(null);
        }
        await loadCatalog();
      } else {
        showToast("Failed to delete category", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveService = async () => {
    if (!newSvcName || !newSvcDesc || !selectedCategory) return;
    try {
      setLoading(true);
      const isEditing = !!editingService;
      const url = '/api/admin/utility/services';
      const method = isEditing ? 'PUT' : 'POST';
      const payload = isEditing 
        ? { id: editingService.id, name: newSvcName, description: newSvcDesc, minAmount: newSvcMin, maxAmount: newSvcMax, customFields: JSON.stringify(svcFields) }
        : { categoryId: selectedCategory.id, name: newSvcName, description: newSvcDesc, minAmount: newSvcMin, maxAmount: newSvcMax, customFields: JSON.stringify(svcFields) };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast(isEditing ? "Service options updated!" : "Utility service option added!", false);
        setNewSvcName('');
        setNewSvcDesc('');
        setNewSvcMin('1');
        setNewSvcMax('1000');
        setSvcFields([]);
        setEditingService(null);
        await loadCatalog();
      } else {
        const data = await res.json();
        showToast(data.error || "Service action failed", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (id) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/utility/services?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (res.ok) {
        showToast("Service deleted!", false);
        await loadCatalog();
      } else {
        showToast("Failed to delete service", true);
      }
    } catch (e) {
      showToast("Server communication error", true);
    } finally {
      setLoading(false);
    }
  };

  // ── ACCESS RESTRICTION CHECK ────────────────────────────────────────────────
  if (!jwtToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
        <h3>Waiting for wallet connection...</h3>
      </div>
    );
  }

  if (!isAdminAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 max-w-md mx-auto">
        <i className="fa-solid fa-triangle-exclamation text-red-500 text-5xl mb-4"></i>
        <h3 className="text-xl font-bold mb-2">Access Denied</h3>
        <p className="text-zinc-500 text-sm mb-6">
          You are currently connected as: <span className="font-mono text-zinc-300 block mt-2 text-xs">{userAddress}</span>
        </p>
        <p className="text-zinc-400 text-xs">
          Only authorized master custodial address owner can view or execute admin panel setups.
        </p>
      </div>
    );
  }

  return (
    <div id="admin-view" className="w-full min-h-screen bg-black text-white font-sans p-6">
      
      {/* Toast Alert Popup */}
      {toast.show && (
        <div className={`toast-alert ${toast.isError ? 'error' : ''}`}>
          <i className={`fa-solid ${toast.isError ? 'fa-circle-xmark' : 'fa-circle-check'} mr-2`}></i>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-900 pb-6 mb-8 gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-500 font-bold font-mono">System Console</span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Admin Configuration</h1>
        </div>
        <div className="text-right">
          <span className="text-xs text-zinc-500 block">Connected Admin Wallet</span>
          <span className="font-mono text-xs text-green-500 bg-zinc-950 px-3 py-1.5 rounded-md border border-zinc-900 mt-1 block">
            {userAddress.substring(0, 6)}...{userAddress.substring(38)}
          </span>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="revolut-tabs mb-8">
        <button className={`revolut-tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          <i className="fa-solid fa-list-check mr-2"></i>Recharge Requests
          {requests.filter(r => r.status === 'PENDING').length > 0 && (
            <span className="ml-2 bg-red-500 text-white rounded-full text-[10px] px-2 py-0.5 font-bold">
              {requests.filter(r => r.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button className={`revolut-tab-btn ${activeTab === 'mlm' ? 'active' : ''}`} onClick={() => setActiveTab('mlm')}>
          <i className="fa-solid fa-sliders mr-2"></i>MLM Config Rules
        </button>
        <button className={`revolut-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>
          <i className="fa-solid fa-gears mr-2"></i>Utility Catalog (Dynamic)
        </button>
      </div>

      {/* Tab Contents */}
      <div className="grid-layout">
        <div className="main-column w-full">

          {/* ────────────────── 1. RECHARGE REQUESTS ────────────────── */}
          {activeTab === 'requests' && (
            <div className="space-y-6">
              <div className="revolut-card">
                <h3 className="card-title">Utility & Recharge Queue</h3>
                <p className="card-desc">Process and review dynamic utility payments, recharges, and purchases requested by platform users.</p>

                <div className="mlm-table-wrapper mt-6">
                  <table className="revolut-table">
                    <thead>
                      <tr>
                        <th>Req ID</th>
                        <th>User Address</th>
                        <th>Category / Service</th>
                        <th>Amount</th>
                        <th>Form Inputs</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center text-zinc-600 py-8">No utility recharge requests registered in the database.</td>
                        </tr>
                      ) : (
                        requests.map(req => {
                          let detailsObj = {};
                          try { detailsObj = JSON.parse(req.details || '{}'); } catch(e){}

                          return (
                            <tr key={req.id} className="border-b border-zinc-900 hover:bg-zinc-950/40">
                              <td className="font-mono text-zinc-400">#{req.id}</td>
                              <td className="font-mono text-xs">
                                <span title={req.userAddress}>{req.userAddress.substring(0, 6)}...{req.userAddress.substring(38)}</span>
                              </td>
                              <td>
                                <span className="text-xs text-zinc-500 block uppercase">{req.categoryName}</span>
                                <span className="font-semibold text-sm">{req.serviceName}</span>
                              </td>
                              <td className="font-bold text-zinc-100">{Number(req.amount).toLocaleString()} ARES</td>
                              <td>
                                <div className="text-xs space-y-0.5 text-zinc-400">
                                  {Object.entries(detailsObj).map(([k, v]) => (
                                    <div key={k}><strong className="text-zinc-500">{k}:</strong> {v}</div>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  req.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                  req.status === 'APPROVED' ? 'bg-green-500/20 text-green-500 border border-green-500/30' :
                                  'bg-red-500/20 text-red-500 border border-red-500/30'
                                }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="text-right">
                                {req.status === 'PENDING' ? (
                                  <div className="flex gap-2 justify-end">
                                    <button 
                                      className="btn-preset active !bg-green-600/20 !text-green-500 border border-green-600/30 hover:!bg-green-600 hover:!text-white"
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setShowApproveModal(true);
                                      }}
                                      disabled={loading}
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      className="btn-preset active !bg-red-600/20 !text-red-500 border border-red-600/30 hover:!bg-red-600 hover:!text-white"
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setShowRejectModal(true);
                                      }}
                                      disabled={loading}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-xs text-zinc-600 text-right italic">
                                    {req.adminNotes ? `"${req.adminNotes}"` : 'Processed'}
                                  </div>
                                )}
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
          )}

          {/* ────────────────── 2. MLM CONFIGS ────────────────── */}
          {activeTab === 'mlm' && (
            <div className="space-y-8">
              
              {/* Tiers Configuration */}
              <div className="revolut-card">
                <h3 className="card-title">MLM Rank Tiers Manager</h3>
                <p className="card-desc">Define the self-investment minimums, recruit milestones, and level depths dynamically without recompiling.</p>
                
                <div className="mlm-table-wrapper mt-6">
                  <table className="revolut-table">
                    <thead>
                      <tr>
                        <th>Rank Tier</th>
                        <th>Min Self Stake (ARES)</th>
                        <th>Min Direct Partners</th>
                        <th>Min Team Volume (ARES)</th>
                        <th>Unlocked Levels</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlmTiers.map((tier, idx) => (
                        <tr key={tier.id}>
                          <td className="font-bold text-blue-400">{tier.name}</td>
                          <td>
                            <input 
                              type="number" 
                              value={tier.minSelfInvestment}
                              className="font-mono text-xs w-28 bg-zinc-950 border border-zinc-900 rounded p-1"
                              onChange={(e) => {
                                const val = e.target.value;
                                setMlmTiers(prev => prev.map((t, i) => i === idx ? { ...t, minSelfInvestment: val } : t));
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              value={tier.minDirects}
                              className="font-mono text-xs w-20 bg-zinc-950 border border-zinc-900 rounded p-1"
                              onChange={(e) => {
                                const val = e.target.value;
                                setMlmTiers(prev => prev.map((t, i) => i === idx ? { ...t, minDirects: val } : t));
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              value={tier.minTeamVolume}
                              className="font-mono text-xs w-28 bg-zinc-950 border border-zinc-900 rounded p-1"
                              onChange={(e) => {
                                const val = e.target.value;
                                setMlmTiers(prev => prev.map((t, i) => i === idx ? { ...t, minTeamVolume: val } : t));
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              min="1"
                              max="10"
                              value={tier.unlockedLevels}
                              className="font-mono text-xs w-20 bg-zinc-950 border border-zinc-900 rounded p-1"
                              onChange={(e) => {
                                const val = e.target.value;
                                setMlmTiers(prev => prev.map((t, i) => i === idx ? { ...t, unlockedLevels: val } : t));
                              }}
                            />
                          </td>
                          <td className="text-right">
                            <button className="btn-preset active" onClick={() => handleUpdateTier(tier)} disabled={loading}>
                              Save
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Levels Configuration */}
              <div className="revolut-card">
                <h3 className="card-title">Downline Level Bonus Rates</h3>
                <p className="card-desc">Define matching commission percentages (Yield/MLM splits) allocated for each downline level (up to 10).</p>

                <div className="mlm-table-wrapper mt-6">
                  <table className="revolut-table">
                    <thead>
                      <tr>
                        <th>Downline Level</th>
                        <th>Matching Bonus (%)</th>
                        <th>Required Member Rank</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlmLevels.map((lvl, idx) => (
                        <tr key={lvl.id}>
                          <td className="font-semibold text-zinc-300">Level #{lvl.level}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                step="0.01"
                                value={lvl.bonus}
                                className="font-mono text-xs w-24 bg-zinc-950 border border-zinc-900 rounded p-1"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMlmLevels(prev => prev.map((l, i) => i === idx ? { ...l, bonus: val } : l));
                                }}
                              />
                              <span className="text-xs text-zinc-500">%</span>
                            </div>
                          </td>
                          <td>
                            <select
                              value={lvl.requiredRank}
                              className="text-xs bg-zinc-950 border border-zinc-900 rounded p-1"
                              onChange={(e) => {
                                const val = e.target.value;
                                setMlmLevels(prev => prev.map((l, i) => i === idx ? { ...l, requiredRank: val } : l));
                              }}
                            >
                              {mlmTiers.map(t => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="text-right">
                            <button className="btn-preset active" onClick={() => handleUpdateLevel(lvl)} disabled={loading}>
                              Save
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── 3. UTILITY CATALOG (DYNAMIC) ────────────────── */}
          {activeTab === 'catalog' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Category selector & CRUD */}
              <div className="revolut-card lg:col-span-1">
                <h3 className="card-title">Categories</h3>
                <p className="card-desc font-xs">Select or add utility categories.</p>

                <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-1">
                  {categories.map(cat => (
                    <div 
                      key={cat.id} 
                      className={`flex justify-between items-center p-3 rounded border cursor-pointer transition ${
                        selectedCategory?.id === cat.id 
                          ? 'bg-blue-600/10 border-blue-500/40 text-white' 
                          : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setEditingService(null);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <i className={`fa-solid ${cat.icon} text-sm ${selectedCategory?.id === cat.id ? 'text-blue-400' : 'text-zinc-500'}`}></i>
                        <span className="font-semibold text-sm">{cat.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="hover:text-blue-400 p-1 text-xs" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(cat);
                            setNewCatName(cat.name);
                            setNewCatIcon(cat.icon);
                          }}
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button 
                          className="hover:text-red-400 p-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(cat.id);
                          }}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-900 mt-6 pt-6 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {editingCategory ? "Edit Category" : "Add New Category"}
                  </h4>
                  <div className="form-group mb-0">
                    <label>Category Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Flight Booking"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>FontAwesome Icon Class</label>
                    <input 
                      type="text" 
                      placeholder="fa-plane"
                      value={newCatIcon}
                      onChange={(e) => setNewCatIcon(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary w-full !py-2 text-xs" onClick={handleSaveCategory} disabled={loading}>
                      {editingCategory ? "Save Changes" : "Create Category"}
                    </button>
                    {editingCategory && (
                      <button 
                        className="btn-preset active w-28 !py-2 text-xs" 
                        onClick={() => {
                          setEditingCategory(null);
                          setNewCatName('');
                          setNewCatIcon('fa-star');
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Services in selected Category */}
              <div className="revolut-card lg:col-span-2">
                <h3 className="card-title">
                  {selectedCategory ? `Services under "${selectedCategory.name}"` : "Dynamic Service Options"}
                </h3>
                <p className="card-desc">Dynamic service options instantly map to the user's spending form categories.</p>

                {selectedCategory ? (
                  <div className="mt-4 space-y-6">
                    
                    {/* List of services */}
                    <div className="space-y-3">
                      {selectedCategory.services?.length === 0 ? (
                        <div className="text-center text-xs text-zinc-600 py-6 border border-dashed border-zinc-900 rounded-lg">
                          No service options configured under this category.
                        </div>
                      ) : (
                        selectedCategory.services?.map(svc => (
                          <div key={svc.id} className="flex justify-between items-start bg-zinc-950 border border-zinc-900 p-4 rounded-lg">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-zinc-200">{svc.name}</h4>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${svc.isActive ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                  {svc.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-1 max-w-md">{svc.description}</p>
                              <div className="flex gap-4 text-[10px] text-zinc-400 mt-2 font-mono">
                                <span>Min: {Number(svc.minAmount).toLocaleString()} ARES</span>
                                <span>Max: {Number(svc.maxAmount).toLocaleString()} ARES</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                className="btn-preset"
                                onClick={() => {
                                  setEditingService(svc);
                                  setNewSvcName(svc.name);
                                  setNewSvcDesc(svc.description);
                                  setNewSvcMin(Number(svc.minAmount).toString());
                                  setNewSvcMax(Number(svc.maxAmount).toString());
                                  try {
                                    const parsed = svc.customFields ? JSON.parse(svc.customFields) : [];
                                    setSvcFields(Array.isArray(parsed) ? parsed : []);
                                  } catch (e) {
                                    setSvcFields([]);
                                  }
                                }}
                              >
                                Edit
                              </button>
                              <button className="btn-preset !bg-red-950/20 !text-red-500 border-red-950/30" onClick={() => handleDeleteService(svc.id)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add/Edit service form */}
                    <div className="border-t border-zinc-900 pt-6 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        {editingService ? `Edit Service Option: "${editingService.name}"` : `Add Service Option under "${selectedCategory.name}"`}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-group mb-0 col-span-1">
                          <label>Service Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Netflix Premium"
                            value={newSvcName}
                            onChange={(e) => setNewSvcName(e.target.value)}
                          />
                        </div>
                        <div className="form-group mb-0 col-span-1">
                          <label>Limits Range (Min - Max ARES)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              placeholder="Min"
                              value={newSvcMin}
                              onChange={(e) => setNewSvcMin(e.target.value)}
                              className="w-full"
                            />
                            <input 
                              type="number" 
                              placeholder="Max"
                              value={newSvcMax}
                              onChange={(e) => setNewSvcMax(e.target.value)}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="form-group mb-0 col-span-2">
                          <label>Description</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Netflix dynamic coupon voucher delivered instantly via email"
                            value={newSvcDesc}
                            onChange={(e) => setNewSvcDesc(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Dynamic Fields Section */}
                      <div className="border border-zinc-900 p-4 rounded-xl mt-4 space-y-4 bg-zinc-950/40">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dynamic User Form Fields</h5>
                        
                        {/* List existing custom fields */}
                        {svcFields.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">No custom fields defined (uses default amount only).</p>
                        ) : (
                          <div className="space-y-2">
                            {svcFields.map(f => (
                              <div key={f.name} className="flex justify-between items-center bg-[#1b1c24] px-3 py-2 rounded-lg text-xs">
                                <div>
                                  <strong className="text-zinc-300">{f.label}</strong>{' '}
                                  <span className="text-zinc-500">({f.name} • {f.type})</span>
                                  {f.placeholder && <span className="text-zinc-650 block mt-0.5">Placeholder: "{f.placeholder}"</span>}
                                </div>
                                <button type="button" className="text-red-450 hover:text-red-400 p-1" onClick={() => handleRemoveSvcField(f.name)}>
                                  <i className="fa-solid fa-xmark"></i>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add new field builder */}
                        <div className="border-t border-zinc-900/60 pt-4 space-y-3">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">Define New Field / Placeholder</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="form-group mb-0">
                              <label style={{ fontSize: '10px' }}>Field Key Name (No space, alphanumeric)</label>
                              <input 
                                type="text" 
                                placeholder="e.g. cardNumber" 
                                value={tempFieldName}
                                onChange={(e) => setTempFieldName(e.target.value)}
                                className="!py-2 !text-xs"
                              />
                            </div>
                            <div className="form-group mb-0">
                              <label style={{ fontSize: '10px' }}>Display Label (Visible to user)</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Credit Card Number" 
                                value={tempFieldLabel}
                                onChange={(e) => setTempFieldLabel(e.target.value)}
                                className="!py-2 !text-xs"
                              />
                            </div>
                            <div className="form-group mb-0">
                              <label style={{ fontSize: '10px' }}>Field Type</label>
                              <select 
                                value={tempFieldType}
                                onChange={(e) => setTempFieldType(e.target.value)}
                                className="w-full bg-[#1b1c24] border border-zinc-800 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                              >
                                <option value="text">Text Input</option>
                                <option value="number">Number Input</option>
                                <option value="file">File Upload Slot (Bill copy, photo proof)</option>
                              </select>
                            </div>
                            <div className="form-group mb-0">
                              <label style={{ fontSize: '10px' }}>Placeholder Hint</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Enter 16-digit card no" 
                                value={tempFieldPlaceholder}
                                onChange={(e) => setTempFieldPlaceholder(e.target.value)}
                                className="!py-2 !text-xs"
                              />
                            </div>
                          </div>
                          <button 
                            type="button" 
                            className="btn-preset active !py-1.5 text-[10px] w-auto px-4 !bg-[#252836]"
                            onClick={handleAddSvcField}
                          >
                            <i className="fa-solid fa-plus mr-1"></i> Add Custom Field
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-6">
                        <button className="btn-primary w-full !py-2 text-xs" onClick={handleSaveService} disabled={loading}>
                          {editingService ? "Save Option" : "Add Service Option"}
                        </button>
                        {editingService && (
                          <button 
                            className="btn-preset active w-28 !py-2 text-xs" 
                            onClick={() => {
                              setEditingService(null);
                              setNewSvcName('');
                              setNewSvcDesc('');
                              setNewSvcMin('1');
                              setNewSvcMax('1000');
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                    <i className="fa-solid fa-folder-open text-4xl mb-4 text-zinc-800"></i>
                    <span>Please select a category on the left to add or manage service options.</span>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Reject Modal Popup Dialog */}
      {showRejectModal && selectedRequest && (
        <div className="modal-backdrop">
          <div className="revolut-card max-w-sm w-full p-6 bg-zinc-950 border border-zinc-900 rounded-xl relative shadow-2xl">
            <h4 className="text-lg font-bold mb-2">Reject Recharge Request</h4>
            <p className="text-xs text-zinc-500 mb-4">
              Rejecting request **#{selectedRequest.id}** will refund **{Number(selectedRequest.amount).toLocaleString()} ARES** back to the user's available portal balance.
            </p>

            <div className="form-group">
              <label>Rejection Reason / Notes</label>
              <textarea
                placeholder="e.g. Phone number invalid, mobile operator rejected network top-up, etc."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows="3"
                className="w-full bg-zinc-950 border border-zinc-900 rounded p-2 text-xs text-white"
              ></textarea>
            </div>

            <div className="flex gap-3 justify-end mt-4">
              <button className="btn-preset active" onClick={() => { setShowRejectModal(false); setActionNotes(''); setSelectedRequest(null); }}>
                Cancel
              </button>
              <button 
                className="btn-primary !bg-red-600 hover:!bg-red-700 !py-2 text-xs" 
                onClick={handleRejectRequest} 
                disabled={loading || !actionNotes}
              >
                Reject & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal Popup Dialog */}
      {showApproveModal && selectedRequest && (
        <div className="modal-backdrop">
          <div className="revolut-card max-w-sm w-full p-6 bg-zinc-950 border border-zinc-900 rounded-xl relative shadow-2xl">
            <h4 className="text-lg font-bold mb-2">Approve Recharge Request</h4>
            <p className="text-xs text-zinc-500 mb-4">
              Approve request **#{selectedRequest.id}** for **{Number(selectedRequest.amount).toLocaleString()} ARES**. Fill in transaction receipt details.
            </p>

            <div className="form-group mb-4">
              <label>Approval Comment / Info</label>
              <textarea
                placeholder="e.g. Recharged successfully on network provider."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows="2"
                className="w-full bg-zinc-950 border border-zinc-900 rounded p-2 text-xs text-white"
              ></textarea>
            </div>

            <div className="form-group mb-4">
              <label>Receipt File / Link / Tx Hash</label>
              <input
                type="text"
                placeholder="Transaction Hash or URL copy"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 rounded p-2 text-xs text-white"
              />
            </div>

            <div className="form-group mb-4">
              <label>Or Upload Payment Receipt Proof</label>
              <label className="btn-secondary cursor-pointer block text-center !py-2 !text-xs font-semibold">
                {uploadingReceipt ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-upload mr-1"></i>}
                {receiptUrl ? 'Replace Uploaded Receipt' : 'Upload Receipt File'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleReceiptUpload}
                />
              </label>
            </div>

            <div className="flex gap-3 justify-end mt-4">
              <button className="btn-preset active" onClick={() => { setShowApproveModal(false); setActionNotes(''); setReceiptUrl(''); setSelectedRequest(null); }}>
                Cancel
              </button>
              <button 
                className="btn-primary !bg-green-600 hover:!bg-green-700 !py-2 text-xs" 
                onClick={handleApproveRequest} 
                disabled={loading || !actionNotes}
              >
                Approve & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS styling overrides specific to Admin Dashboard view layout */}
      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(4px);
        }
      `}</style>

    </div>
  );
}
