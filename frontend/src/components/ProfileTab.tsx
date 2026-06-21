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
    <div id="tab-profile" className="space-y-6">

      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-xl text-sm font-semibold ${
          toast.isError
            ? 'bg-red-950/90 border-red-800/60 text-red-200'
            : 'bg-emerald-950/90 border-emerald-800/60 text-emerald-200'
        }`}>
          <i className={`fa-solid ${toast.isError ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm`} />
          <span>{toast.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

        {/* LEFT: Profile Form */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 relative overflow-hidden hover:border-zinc-700/50 transition-all duration-300">
          {isLocked && (
            <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-4 rounded-bl-xl">
              Locked
            </div>
          )}

          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Personal</div>
          <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Profile Settings</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Keep your details updated. You can change your information up to 3 times. Verify your profile for account compliance.</p>

          {/* Status Banner */}
          {isLocked ? (
            <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-900/40 rounded-xl text-xs text-red-400 mb-6">
              <i className="fa-solid fa-lock text-base flex-shrink-0 mt-0.5" />
              <div>
                <strong>All updates used!</strong> Your profile settings are now permanently locked for verification. Contact support for assistance.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-400 mb-6">
              <i className="fa-solid fa-circle-info text-base flex-shrink-0 mt-0.5" />
              <div>
                <strong>Profile Updates: {remainingUpdates} of 3 remaining.</strong> Saving changes will decrease your remaining edit attempts.
              </div>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Full Name', id: 'p-name', type: 'text', value: name, setter: setName, placeholder: 'Enter full legal name' },
                { label: 'Mobile Number', id: 'p-mobile', type: 'text', value: mobile, setter: setMobile, placeholder: 'e.g. +1234567890' },
              ].map(field => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">{field.label}</label>
                  <input
                    type={field.type}
                    id={field.id}
                    value={field.value}
                    disabled={isLocked}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/30 placeholder-zinc-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Aadhaar Card Number', id: 'p-aadhar-no', type: 'text', value: aadhaarNo, setter: setAadhaarNo, placeholder: '12-digit Aadhaar Number', maxLen: 12 },
                { label: 'PAN Card Number', id: 'p-pan-no', type: 'text', value: panNo, setter: setPanNo, placeholder: '10-digit PAN Number', maxLen: 10, upper: true },
              ].map(field => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">{field.label}</label>
                  <input
                    type={field.type}
                    id={field.id}
                    value={field.value}
                    disabled={isLocked}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    maxLength={field.maxLen}
                    className={`w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/30 placeholder-zinc-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${field.upper ? 'uppercase' : ''}`}
                  />
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="p-address" className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Residential Address</label>
              <input
                type="text"
                id="p-address"
                value={address}
                disabled={isLocked}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street name, house number, apartment, etc."
                className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 placeholder-zinc-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'City', id: 'p-city', value: city, setter: setCity, placeholder: 'City' },
                { label: 'State', id: 'p-state', value: state, setter: setState, placeholder: 'State' },
                { label: 'ZIP / PIN', id: 'p-zip', value: zip, setter: setZip, placeholder: 'ZIP Code' },
              ].map(field => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">{field.label}</label>
                  <input
                    type="text"
                    id={field.id}
                    value={field.value}
                    disabled={isLocked}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-zinc-950/80 border border-zinc-800/60 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zinc-600 placeholder-zinc-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full py-3.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <><i className="fa-solid fa-spinner fa-spin" /> Saving...</> : '💾 Save Profile Details'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: Rank + Documents */}
        <div className="flex flex-col gap-6">

          {/* Rank Card */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">MLM Status</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Current Leadership Rank</div>
                <div className="text-2xl font-black text-blue-400">{rank}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <i className="fa-solid fa-award text-blue-400 text-2xl" />
              </div>
            </div>
          </div>

          {/* Identity Documents */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/50 transition-all duration-300">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">KYC</div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-1.5">Identity Documents</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Upload high-quality scans of your KYC credentials.</p>

            <div className="space-y-4">
              {[
                { key: 'aadharFront', label: 'Aadhaar Front', subtitle: 'Front side of card copy', url: aadharFrontUrl, uploading: uploading.aadharFront, alt: 'Aadhaar Front' },
                { key: 'aadharBack', label: 'Aadhaar Back', subtitle: 'Reverse address side', url: aadharBackUrl, uploading: uploading.aadharBack, alt: 'Aadhaar Back' },
                { key: 'panCard', label: 'PAN Card', subtitle: 'Front tax identification card', url: panCardUrl, uploading: uploading.panCard, alt: 'PAN Card' },
              ].map(doc => (
                <div key={doc.key} className="bg-zinc-950/40 rounded-xl border border-zinc-800/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold text-zinc-200">{doc.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{doc.subtitle}</div>
                    </div>
                    {doc.url ? (
                      <span className="text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 rounded-full px-2.5 py-0.5">✓ Uploaded</span>
                    ) : (
                      <span className="text-[10px] font-bold bg-zinc-800/60 text-zinc-500 rounded-full px-2.5 py-0.5">Empty</span>
                    )}
                  </div>

                  {doc.url && (
                    <div className="mb-3 rounded-xl overflow-hidden border border-zinc-800/40 aspect-[1.6/1] bg-black flex items-center justify-center relative group">
                      <img src={doc.url} alt={doc.alt} className="object-contain h-full w-full" />
                      <a href={doc.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white opacity-0 group-hover:opacity-100 transition duration-200">
                        <i className="fa-solid fa-expand mr-1.5" /> View Original
                      </a>
                    </div>
                  )}

                  <label className={`flex items-center justify-center gap-2 w-full py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer ${isLocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                    {doc.uploading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-upload" />}
                    {doc.url ? `Replace ${doc.label}` : `Upload ${doc.label}`}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={isLocked}
                      onChange={(e) => handleFileUpload(e, doc.key)}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

