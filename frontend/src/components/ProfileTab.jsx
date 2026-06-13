'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';

export default function ProfileTab() {
  const { userAddress, jwtToken, userProfile, loadProfile } = useWeb3();

  // Form input states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [panNo, setPanNo] = useState('');

  // Uploaded document URL states
  const [aadharFrontUrl, setAadharFrontUrl] = useState('');
  const [aadharBackUrl, setAadharBackUrl] = useState('');
  const [panCardUrl, setPanCardUrl] = useState('');

  // Loader & Toast states
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({
    aadharFront: false,
    aadharBack: false,
    panCard: false
  });
  const [toast, setToast] = useState({ message: '', show: false, isError: false });

  const showToast = (message, isError = false) => {
    setToast({ message, show: true, isError });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Sync inputs with userProfile once loaded
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setMobile(userProfile.mobile || '');
      setAddress(userProfile.address || '');
      setCity(userProfile.city || '');
      setState(userProfile.state || '');
      setZip(userProfile.zip || '');
      setAadhaarNo(userProfile.aadhaarNo || '');
      setPanNo(userProfile.panNo || '');
      setAadharFrontUrl(userProfile.aadharFrontUrl || '');
      setAadharBackUrl(userProfile.aadharBackUrl || '');
      setPanCardUrl(userProfile.panCardUrl || '');
    }
  }, [userProfile]);

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Optional client-side validations
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size must be under 5MB!", true);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(prev => ({ ...prev, [type]: true }));
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
        if (type === 'aadharFront') setAadharFrontUrl(data.url);
        if (type === 'aadharBack') setAadharBackUrl(data.url);
        if (type === 'panCard') setPanCardUrl(data.url);
        showToast("Document uploaded successfully!", false);
      } else {
        showToast(data.error || "Upload failed.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to upload document file.", true);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!jwtToken) return;

    if (!name || !mobile) {
      showToast("Name and Mobile number are required!", true);
      return;
    }

    const remaining = userProfile?.profileUpdatesRemaining ?? 3;
    if (remaining <= 0) {
      showToast("You have no profile updates remaining!", true);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          name,
          mobile,
          address,
          city,
          state,
          zip,
          aadhaarNo,
          panNo,
          aadharFrontUrl,
          aadharBackUrl,
          panCardUrl
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Profile details saved successfully!", false);
        await loadProfile(); // Reload global profile state
      } else {
        showToast(data.error || "Failed to update profile.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating profile details.", true);
    } finally {
      setLoading(false);
    }
  };

  const remainingUpdates = userProfile?.profileUpdatesRemaining ?? 3;
  const isLocked = remainingUpdates <= 0;
  const rank = userProfile?.rank || 'Default';

  return (
    <div className="tab-content active" id="tab-profile">
      
      {/* Toast Alert Banner */}
      {toast.show && (
        <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'toast-error' : 'toast-success'}`}>
          <i className={toast.isError ? 'fa-solid fa-circle-exclamation text-red-500' : 'fa-solid fa-circle-check text-green-500'}></i>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="grid-layout">
        
        {/* Left Form Column */}
        <div className="main-column">
          <div className="revolut-card relative overflow-hidden">
            
            {/* Locked overlay badge */}
            {isLocked && (
              <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-4 rounded-bl-lg">
                Locked
              </div>
            )}

            <h3 className="card-title">Profile Settings</h3>
            <p className="card-desc">Keep your details updated. You can change your information up to 3 times. Verify your profile for account compliance.</p>

            {/* Lock Status Banner */}
            {isLocked ? (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs flex items-center gap-3 mb-6">
                <i className="fa-solid fa-lock text-lg"></i>
                <div>
                  <strong>All updates used!</strong> Your profile settings are now permanently locked for verification. Contact support for assistance.
                </div>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-4 rounded-xl text-xs flex items-center gap-3 mb-6">
                <i className="fa-solid fa-circle-info text-lg"></i>
                <div>
                  <strong>Profile Updates: {remainingUpdates} of 3 remaining.</strong> Saving changes will decrease your remaining edit attempts.
                </div>
              </div>
            )}

            {/* Profile Input Forms */}
            <form onSubmit={handleSaveProfile} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group mb-0">
                  <label htmlFor="p-name">Full Name</label>
                  <input 
                    type="text" 
                    id="p-name" 
                    value={name}
                    disabled={isLocked}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full legal name"
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="form-group mb-0">
                  <label htmlFor="p-mobile">Mobile Number</label>
                  <input 
                    type="text" 
                    id="p-mobile" 
                    value={mobile}
                    disabled={isLocked}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. +1234567890"
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group mb-0">
                  <label htmlFor="p-aadhar-no">Aadhaar Card Number</label>
                  <input 
                    type="text" 
                    id="p-aadhar-no" 
                    value={aadhaarNo}
                    disabled={isLocked}
                    onChange={(e) => setAadhaarNo(e.target.value)}
                    placeholder="12-digit Aadhaar Number"
                    maxLength="12"
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="form-group mb-0">
                  <label htmlFor="p-pan-no">PAN Card Number</label>
                  <input 
                    type="text" 
                    id="p-pan-no" 
                    value={panNo}
                    disabled={isLocked}
                    onChange={(e) => setPanNo(e.target.value)}
                    placeholder="10-digit PAN Number"
                    maxLength="10"
                    className="disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  />
                </div>
              </div>

              <div className="form-group mb-0">
                <label htmlFor="p-address">Residential Address</label>
                <input 
                  type="text" 
                  id="p-address" 
                  value={address}
                  disabled={isLocked}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street name, house number, apartment, etc."
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="form-group mb-0 col-span-1">
                  <label htmlFor="p-city">City</label>
                  <input 
                    type="text" 
                    id="p-city" 
                    value={city}
                    disabled={isLocked}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="form-group mb-0 col-span-1">
                  <label htmlFor="p-state">State</label>
                  <input 
                    type="text" 
                    id="p-state" 
                    value={state}
                    disabled={isLocked}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="form-group mb-0 col-span-1">
                  <label htmlFor="p-zip">ZIP / PIN</label>
                  <input 
                    type="text" 
                    id="p-zip" 
                    value={zip}
                    disabled={isLocked}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="ZIP Code"
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading || isLocked}>
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Save Profile Details'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Documents Column */}
        <div className="side-column">
          
          {/* Rank Card Info */}
          <div className="revolut-card bg-gradient-to-br from-[#111218] to-[#16171e]">
            <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-3">MLM Status</h4>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block">Current Leadership Rank</span>
                <span className="text-xl font-extrabold text-blue-400 block mt-1">{rank}</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
                <i className="fa-solid fa-award text-2xl"></i>
              </div>
            </div>
          </div>

          {/* Identity Document Verification */}
          <div className="revolut-card">
            <h3 className="card-title">Identity Documents</h3>
            <p className="card-desc">Upload high-quality scans of your KYC credentials. Placeholders will enable immediate preview.</p>

            <div className="space-y-4">
              
              {/* Document 1: Aadhaar Front */}
              <div className="border border-zinc-900 rounded-xl p-4 bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">Aadhaar Front</span>
                    <span className="text-[10px] text-zinc-500">Front side of card copy</span>
                  </div>
                  {aadharFrontUrl ? (
                    <span className="text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 rounded-full px-2 py-0.5">
                      Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-zinc-800 text-zinc-500 rounded-full px-2 py-0.5">
                      Empty
                    </span>
                  )}
                </div>

                {aadharFrontUrl && (
                  <div className="mb-3 rounded overflow-hidden border border-zinc-900 aspect-[1.6/1] bg-black flex items-center justify-center relative group">
                    <img src={aadharFrontUrl} alt="Aadhaar Front" className="object-contain h-full w-full" />
                    <a href={aadharFrontUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white opacity-0 group-hover:opacity-100 transition duration-200">
                      <i className="fa-solid fa-expand mr-1.5"></i> View Original
                    </a>
                  </div>
                )}

                <label className={`btn-secondary cursor-pointer block text-center !py-2 !text-xs ${isLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                  {uploading.aadharFront ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-upload mr-1"></i>}
                  {aadharFrontUrl ? 'Replace Front File' : 'Upload Front Image'}
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    className="hidden" 
                    disabled={isLocked}
                    onChange={(e) => handleFileUpload(e, 'aadharFront')}
                  />
                </label>
              </div>

              {/* Document 2: Aadhaar Back */}
              <div className="border border-zinc-900 rounded-xl p-4 bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">Aadhaar Back</span>
                    <span className="text-[10px] text-zinc-500">Reverse address side</span>
                  </div>
                  {aadharBackUrl ? (
                    <span className="text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 rounded-full px-2 py-0.5">
                      Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-zinc-800 text-zinc-500 rounded-full px-2 py-0.5">
                      Empty
                    </span>
                  )}
                </div>

                {aadharBackUrl && (
                  <div className="mb-3 rounded overflow-hidden border border-zinc-900 aspect-[1.6/1] bg-black flex items-center justify-center relative group">
                    <img src={aadharBackUrl} alt="Aadhaar Back" className="object-contain h-full w-full" />
                    <a href={aadharBackUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white opacity-0 group-hover:opacity-100 transition duration-200">
                      <i className="fa-solid fa-expand mr-1.5"></i> View Original
                    </a>
                  </div>
                )}

                <label className={`btn-secondary cursor-pointer block text-center !py-2 !text-xs ${isLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                  {uploading.aadharBack ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-upload mr-1"></i>}
                  {aadharBackUrl ? 'Replace Back File' : 'Upload Back Image'}
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    className="hidden" 
                    disabled={isLocked}
                    onChange={(e) => handleFileUpload(e, 'aadharBack')}
                  />
                </label>
              </div>

              {/* Document 3: PAN Card */}
              <div className="border border-zinc-900 rounded-xl p-4 bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">PAN Card</span>
                    <span className="text-[10px] text-zinc-500">Front tax identification card</span>
                  </div>
                  {panCardUrl ? (
                    <span className="text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 rounded-full px-2 py-0.5">
                      Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-zinc-800 text-zinc-500 rounded-full px-2 py-0.5">
                      Empty
                    </span>
                  )}
                </div>

                {panCardUrl && (
                  <div className="mb-3 rounded overflow-hidden border border-zinc-900 aspect-[1.6/1] bg-black flex items-center justify-center relative group">
                    <img src={panCardUrl} alt="PAN Card" className="object-contain h-full w-full" />
                    <a href={panCardUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white opacity-0 group-hover:opacity-100 transition duration-200">
                      <i className="fa-solid fa-expand mr-1.5"></i> View Original
                    </a>
                  </div>
                )}

                <label className={`btn-secondary cursor-pointer block text-center !py-2 !text-xs ${isLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                  {uploading.panCard ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-upload mr-1"></i>}
                  {panCardUrl ? 'Replace PAN Card' : 'Upload PAN Image'}
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    className="hidden" 
                    disabled={isLocked}
                    onChange={(e) => handleFileUpload(e, 'panCard')}
                  />
                </label>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
