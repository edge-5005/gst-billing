import React, { useState, useEffect } from 'react';
import { Save, Building2, MapPin, Landmark, FileText, Loader2 } from 'lucide-react';
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
};

export default function CompanyProfile() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadCompany() {
      try {
        const data = await api.get('/company');
        if (data) {
          setForm((prev) => ({ ...prev, ...data }));
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
      return updated;
    });
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
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
      toast.success('Company profile saved successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to save company profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading company profile..." />;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="page-header">Company Profile</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Details */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Business Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
              <input
                type="text"
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
                maxLength={15}
                className={`input-field uppercase ${errors.gstin ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="22AAAAA0000A1Z5"
              />
              {errors.gstin && <p className="text-xs text-red-500 mt-1">{errors.gstin}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
              <input
                type="text"
                name="pan"
                value={form.pan}
                onChange={handleChange}
                maxLength={10}
                className={`input-field uppercase ${errors.pan ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="AAAAA0000A"
              />
              {errors.pan && <p className="text-xs text-red-500 mt-1">{errors.pan}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={`input-field ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="company@example.com"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Address</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={2}
                className="input-field"
                placeholder="Enter street address"
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
                  <option key={code} value={name}>{name}</option>
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
                className="input-field bg-gray-50"
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
                className="input-field"
                placeholder="Enter pincode"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Bank Details</h2>
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
                placeholder="Enter bank name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                name="bank_account"
                value={form.bank_account}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter account number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                name="bank_ifsc"
                value={form.bank_ifsc}
                onChange={handleChange}
                className="input-field uppercase"
                placeholder="Enter IFSC code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
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
            <h2 className="text-lg font-semibold text-gray-800">Invoice Settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
              <input
                type="text"
                name="invoice_prefix"
                value={form.invoice_prefix}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., INV"
              />
              <p className="text-xs text-gray-400 mt-1">
                Invoices will be numbered as {form.invoice_prefix || 'INV'}-001, {form.invoice_prefix || 'INV'}-002, etc.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
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
