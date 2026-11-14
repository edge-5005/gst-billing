import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, User, MapPin, Truck, Loader2 } from 'lucide-react';
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
  billing_address: '',
  billing_city: '',
  billing_state: '',
  billing_state_code: '',
  billing_pincode: '',
  shipping_address: '',
  shipping_city: '',
  shipping_state: '',
  shipping_state_code: '',
  shipping_pincode: '',
};

export default function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = id && id !== 'new';

  const [form, setForm] = useState(initialForm);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isEdit) return;
    async function loadCustomer() {
      try {
        const data = await api.get(`/customers/${id}`);
        setForm((prev) => ({ ...prev, ...data }));
        if (
          data.shipping_address === data.billing_address &&
          data.shipping_city === data.billing_city &&
          data.shipping_state === data.billing_state &&
          data.shipping_pincode === data.billing_pincode &&
          data.billing_address
        ) {
          setSameAsBilling(true);
        }
      } catch (err) {
        toast.error('Failed to load customer');
        navigate('/customers');
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [id, isEdit, navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === 'billing_state') {
        const code = Object.entries(STATE_CODES).find(([, v]) => v === value);
        updated.billing_state_code = code ? code[0] : '';
      }
      if (name === 'billing_state_code') {
        updated.billing_state = STATE_CODES[value] || '';
      }
      if (name === 'shipping_state') {
        const code = Object.entries(STATE_CODES).find(([, v]) => v === value);
        updated.shipping_state_code = code ? code[0] : '';
      }
      if (name === 'shipping_state_code') {
        updated.shipping_state = STATE_CODES[value] || '';
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
            updated.billing_state_code = sCode;
            updated.billing_state = STATE_CODES[sCode];
            if (sameAsBilling) {
              updated.shipping_state_code = sCode;
              updated.shipping_state = STATE_CODES[sCode];
            }
          }
        }
        if (clean.length === 15) {
          setTimeout(async () => {
            try {
              const res = await api.get(`/company/fetch-gstin/${clean}`);
              if (res && res.success) {
                setForm((cur) => {
                  const u = {
                    ...cur,
                    name: cur.name || res.legal_name || res.trade_name,
                    billing_address: cur.billing_address || res.address,
                    billing_city: cur.billing_city || res.city,
                    billing_pincode: cur.billing_pincode || res.pincode,
                    phone: cur.phone || res.phone,
                    email: cur.email || res.email,
                  };
                  if (sameAsBilling) {
                    u.shipping_address = u.billing_address;
                    u.shipping_city = u.billing_city;
                    u.shipping_pincode = u.billing_pincode;
                  }
                  return u;
                });
                toast.info(`Auto-filled details for ${res.legal_name || clean}`);
              }
            } catch (e) {}
          }, 300);
        }
      }

      if (sameAsBilling && name.startsWith('billing_')) {
        const shippingField = name.replace('billing_', 'shipping_');
        updated[shippingField] = updated[name];
        if (name === 'billing_state') {
          updated.shipping_state = updated.billing_state;
          updated.shipping_state_code = updated.billing_state_code;
        }
      }

      return updated;
    });

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function handleSameAsBilling(checked) {
    setSameAsBilling(checked);
    if (checked) {
      setForm((prev) => ({
        ...prev,
        shipping_address: prev.billing_address,
        shipping_city: prev.billing_city,
        shipping_state: prev.billing_state,
        shipping_state_code: prev.billing_state_code,
        shipping_pincode: prev.billing_pincode,
      }));
    }
  }

  function validate() {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Customer name is required';
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format';
    }
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan)) {
      newErrors.pan = 'Invalid PAN format';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      if (isEdit) {
        await api.put(`/customers/${id}`, form);
        toast.success('Customer updated successfully');
      } else {
        await api.post('/customers', form);
        toast.success('Customer created successfully');
      }
      navigate('/customers');
    } catch (err) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading customer..." />;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/customers')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="page-header mb-0">{isEdit ? 'Edit Customer' : 'New Customer'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Basic Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={`input-field ${errors.name ? 'border-red-400' : ''}`}
                placeholder="Enter customer name"
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
                className={`input-field uppercase ${errors.gstin ? 'border-red-400' : ''}`}
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
                className={`input-field uppercase ${errors.pan ? 'border-red-400' : ''}`}
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
                className={`input-field ${errors.email ? 'border-red-400' : ''}`}
                placeholder="customer@example.com"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Billing Address</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                name="billing_address"
                value={form.billing_address}
                onChange={handleChange}
                rows={2}
                className="input-field"
                placeholder="Enter billing address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="billing_city"
                value={form.billing_city}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter city"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                name="billing_state"
                value={form.billing_state}
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
                name="billing_state_code"
                value={form.billing_state_code}
                readOnly
                className="input-field bg-gray-50"
                placeholder="Auto-filled"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                type="text"
                name="billing_pincode"
                value={form.billing_pincode}
                onChange={handleChange}
                maxLength={6}
                className="input-field"
                placeholder="Enter pincode"
              />
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-800">Shipping Address</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={(e) => handleSameAsBilling(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Same as billing</span>
            </label>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${sameAsBilling ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                name="shipping_address"
                value={form.shipping_address}
                onChange={handleChange}
                rows={2}
                className="input-field"
                placeholder="Enter shipping address"
                disabled={sameAsBilling}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="shipping_city"
                value={form.shipping_city}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter city"
                disabled={sameAsBilling}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                name="shipping_state"
                value={form.shipping_state}
                onChange={handleChange}
                className="select-field"
                disabled={sameAsBilling}
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
                name="shipping_state_code"
                value={form.shipping_state_code}
                readOnly
                className="input-field bg-gray-50"
                placeholder="Auto-filled"
                disabled={sameAsBilling}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                type="text"
                name="shipping_pincode"
                value={form.shipping_pincode}
                onChange={handleChange}
                maxLength={6}
                className="input-field"
                placeholder="Enter pincode"
                disabled={sameAsBilling}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/customers')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Update Customer' : 'Create Customer'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
