import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  Building2,
  MapPin,
  Landmark,
  FileText,
  Loader2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../utils/api';
import { STATE_CODES } from '../utils/helpers';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';

const initialForm = {
  name: '',
  gstin: '',
  pan: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  state_code: '',
  pincode: '',
  bank_name: '',
  bank_account: '',
  bank_ifsc: '',
  bank_branch: '',
  invoice_prefix: 'INV',
  logo_url: '',
};

export default function CompanyProfile() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingGst, setFetchingGst] = useState(false);
  const [gstMeta, setGstMeta] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);
  const lastFetchedGstin = useRef('');

  useEffect(() => {
    async function loadCompany() {
      try {
        const data = await api.get('/company');
        if (data) {
          setForm((prev) => ({
            ...prev,
            ...data,
            logo_url: data.logo_url || '',
          }));
          if (data.gstin && data.gstin.length === 15) {
            lastFetchedGstin.current = data.gstin.toUpperCase();
          }
        }
      } catch (err) {
        if (!err.message.includes('404')) {
          toast.error('Failed to load company profile');
        }
      } finally {
        setLoading(false);
      }
    }
    loadCompany();
  }, []);

  // Fetch GST data from backend and auto-fill company fields
  async function executeGstFetch(gstinToFetch, isAuto = false) {
    const clean = (gstinToFetch || '').trim().toUpperCase();
    if (!clean) {
      if (!isAuto) toast.warning('Please enter a 15-character GSTIN number first');
      return;
    }

    if (clean.length !== 15) {
      if (!isAuto) toast.error('GSTIN must be exactly 15 characters (e.g. 33AABCT3518Q1ZU)');
      return;
    }

    if (clean === lastFetchedGstin.current && isAuto) {
      return;
    }

    try {
      setFetchingGst(true);
      lastFetchedGstin.current = clean;
      const res = await api.get(`/company/fetch-gstin/${clean}`);

      if (res && res.success) {
        setForm((prev) => {
          const isDemoCompany =
            prev.name.includes('Apex Infotech') ||
            prev.name.includes('Acme Solutions');

          const updated = {
            ...prev,
            pan: res.pan || prev.pan,
            state: res.state || prev.state,
            state_code: res.state_code || prev.state_code,
          };

          // If the profile is still holding sample demo data, clear it to prevent mismatched wrong company data
          if (isDemoCompany && !res.is_verified) {
            updated.name = '';
            updated.address = '';
            updated.city = '';
            updated.pincode = '';
            updated.phone = '';
            updated.email = '';
            updated.bank_name = '';
            updated.bank_account = '';
            updated.bank_ifsc = '';
            updated.bank_branch = '';
          }

          // When verified records are returned from registry or live API, populate authentic fields
          if (res.is_verified && res.legal_name) {
            updated.name = res.legal_name;
            if (res.address) updated.address = res.address;
            if (res.city) updated.city = res.city;
            if (res.pincode) updated.pincode = res.pincode;
            if (res.phone) updated.phone = res.phone;
            if (res.email) updated.email = res.email;
          }
          return updated;
        });

        setGstMeta({
          legal_name: res.legal_name || '',
          trade_name: res.trade_name || '',
          constitution: res.constitution,
          status: res.status,
          state: res.state,
          state_code: res.state_code,
          pan: res.pan,
          source: res.source,
          is_verified: res.is_verified,
        });

        if (res.is_verified && res.legal_name) {
          toast.success(`Verified Business Found: ${res.legal_name}`);
        } else {
          toast.info(`GSTIN Validated for ${res.state} (${res.constitution}) • PAN: ${res.pan}`);
        }
      }
    } catch (err) {
      if (!isAuto) {
        toast.error(err.message || 'Failed to validate GSTIN');
      }
    } finally {
      setFetchingGst(false);
    }
  }

  function handleResetProfile() {
    setForm({
      ...initialForm,
      invoice_prefix: form.invoice_prefix || 'INV',
    });
    setGstMeta(null);
    lastFetchedGstin.current = '';
    toast.info('Cleared demo data. Enter your company details and click Save.');
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'state') {
        const code = Object.entries(STATE_CODES).find(([, v]) => v === value);
        updated.state_code = code ? code[0] : '';
      }
      if (name === 'state_code') {
        updated.state = STATE_CODES[value] || '';
      }
      if (name === 'gstin') {
        const clean = value.toUpperCase().trim();
        updated.gstin = clean;
        if (clean.length >= 10) {
          updated.pan = clean.substring(2, 12);
        }
        if (clean.length >= 2) {
          const sCode = clean.substring(0, 2);
          if (STATE_CODES[sCode]) {
            updated.state_code = sCode;
            updated.state = STATE_CODES[sCode];
          }
        }
        // Auto-fetch immediately when 15 characters are entered
        if (clean.length === 15) {
          setTimeout(() => executeGstFetch(clean, true), 250);
        }
      }
      return updated;
    });

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  // Handle Logo file upload
  function handleLogoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target.result;
      setForm((prev) => ({ ...prev, logo_url: base64Url }));
      toast.success('Company logo uploaded. Click "Save Company Profile" to apply.');
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setForm((prev) => ({ ...prev, logo_url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info('Logo removed. Save to apply changes.');
  }

  function validate() {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Company name is required';
    if (form.gstin && form.gstin.length !== 15) newErrors.gstin = 'GSTIN must be 15 characters';
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format';
    }
    if (form.pan && form.pan.length !== 10) newErrors.pan = 'PAN must be 10 characters';
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan)) {
      newErrors.pan = 'Invalid PAN format';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      await api.put('/company', form);
      toast.success('Company profile saved successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to save company profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading company profile..." />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header mb-0">Company Profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure your business identity, GST registration, company logo, and invoice branding
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetProfile}
            className="btn-secondary text-sm"
            title="Clear demo data and start with a fresh profile"
          >
            <RefreshCw className="w-4 h-4" />
            Clear Demo Data
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Logo Section */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">Company Logo</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 group">
              {form.logo_url ? (
                <>
                  <img
                    src={form.logo_url}
                    alt="Company Logo Preview"
                    className="w-full h-full object-contain p-2"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-white text-gray-700 rounded-lg shadow hover:bg-gray-100"
                      title="Change Logo"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="p-1.5 bg-red-600 text-white rounded-lg shadow hover:bg-red-700"
                      title="Remove Logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-gray-100 transition w-full h-full"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-1" />
                  <span className="text-xs font-medium text-gray-500">Upload Logo</span>
                </div>
              )}
            </div>

            <div className="space-y-3 flex-1 text-center sm:text-left">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  {form.logo_url ? 'Active Brand Logo' : 'No Logo Uploaded Yet'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Your logo will appear on all printed Tax Invoices, Quotations, and Purchase Orders.
                  Supports PNG, JPG, JPEG, SVG or WebP formats up to 5MB.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs py-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {form.logo_url ? 'Replace Logo' : 'Select Image File'}
                </button>

                {form.logo_url && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded transition"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Business Details with GST Auto-Fetch */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">Business Details & GSTIN</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GSTIN with Fetch Button */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSTIN Number (Goods & Services Tax Identification Number)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    name="gstin"
                    value={form.gstin}
                    onChange={handleChange}
                    onBlur={(e) => {
                      const clean = e.target.value.trim().toUpperCase();
                      if (clean.length === 15) {
                        executeGstFetch(clean, true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        executeGstFetch(form.gstin, false);
                      }
                    }}
                    maxLength={15}
                    className={`input-field uppercase font-mono tracking-wider ${
                      errors.gstin ? 'border-red-400 focus:ring-red-400' : ''
                    }`}
                    placeholder="e.g., 33AABCT3518Q1ZU"
                  />
                  {fetchingGst && (
                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-indigo-600 flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validating...
                    </span>
                  )}
                  {!fetchingGst && form.gstin?.length === 15 && (
                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      15 Digits
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => executeGstFetch(form.gstin, false)}
                  disabled={fetchingGst || !form.gstin}
                  className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-sm whitespace-nowrap px-4 py-2"
                >
                  {fetchingGst ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking GSTIN...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Validate / Fetch GST
                    </>
                  )}
                </button>
              </div>
              {errors.gstin && <p className="text-xs text-red-500 mt-1">{errors.gstin}</p>}
              <p className="text-xs text-gray-500 mt-1">
                State, State Code, and PAN are automatically extracted and verified from the GSTIN. Enter your business name below or click <strong>Validate / Fetch GST</strong>.
              </p>
            </div>

            {/* GST Verification Banner if metadata fetched */}
            {gstMeta && (
              <div className={`md:col-span-2 p-3 border rounded-lg text-xs flex items-center justify-between ${
                gstMeta.is_verified ? 'bg-green-50 border-green-200 text-green-900' : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${gstMeta.is_verified ? 'text-green-600' : 'text-blue-600'}`} />
                  <div>
                    <span className="font-bold">
                      {gstMeta.is_verified
                        ? `Verified GST Registration (${gstMeta.legal_name || 'Active'})`
                        : `GSTIN Format Validated (${gstMeta.state || ''})`}
                    </span>
                    <span className="ml-2">
                      • {gstMeta.constitution} • State: {gstMeta.state} ({gstMeta.state_code}) • PAN: {gstMeta.pan}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Company Legal / Trade Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company / Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={`input-field ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="Enter company name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <input
                type="text"
                name="pan"
                value={form.pan}
                onChange={handleChange}
                maxLength={10}
                className={`input-field uppercase font-mono ${errors.pan ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="AAAAA0000A"
              />
              {errors.pan && <p className="text-xs text-red-500 mt-1">{errors.pan}</p>}
              <p className="text-[11px] text-gray-400 mt-0.5">Extracted automatically from GSTIN</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="input-field"
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={`input-field ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="billing@yourcompany.com"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Registered Office Address</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={2}
                className="input-field"
                placeholder="Building, street, landmark, area"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter city"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                name="state"
                value={form.state}
                onChange={handleChange}
                className="select-field"
              >
                <option value="">Select State</option>
                {Object.entries(STATE_CODES).map(([code, name]) => (
                  <option key={code} value={name}>
                    {code} - {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State Code</label>
              <input
                type="text"
                name="state_code"
                value={form.state_code}
                onChange={handleChange}
                className="input-field bg-gray-50 font-mono"
                readOnly
                placeholder="Auto-filled"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                type="text"
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                maxLength={6}
                className="input-field font-mono"
                placeholder="e.g., 600001"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Bank Details for Invoices</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                name="bank_name"
                value={form.bank_name}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., HDFC Bank, ICICI Bank, SBI"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                name="bank_account"
                value={form.bank_account}
                onChange={handleChange}
                className="input-field font-mono"
                placeholder="Enter bank account number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                name="bank_ifsc"
                value={form.bank_ifsc}
                onChange={handleChange}
                className="input-field uppercase font-mono"
                placeholder="e.g., HDFC0001234"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
              <input
                type="text"
                name="bank_branch"
                value={form.bank_branch}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter branch name"
              />
            </div>
          </div>
        </div>

        {/* Invoice Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-800">Invoice Series & Numbering</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
              <input
                type="text"
                name="invoice_prefix"
                value={form.invoice_prefix}
                onChange={handleChange}
                className="input-field font-mono"
                placeholder="e.g., INV"
              />
              <p className="text-xs text-gray-400 mt-1">
                Invoices will be auto-generated with this prefix (e.g. {form.invoice_prefix || 'INV'}-2026-0001).
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Profile...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Company Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
