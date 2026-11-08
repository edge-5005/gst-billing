import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Package, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { GST_RATES, UNITS } from '../utils/helpers';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';

const initialForm = {
  name: '',
  hsn_sac: '',
  type: 'goods',
  unit: 'NOS',
  sale_price: '',
  purchase_price: '',
  gst_rate: 18,
  stock_qty: 0,
};

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = id && id !== 'new';

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isEdit) return;
    async function loadProduct() {
      try {
        const data = await api.get(`/products/${id}`);
        setForm((prev) => ({
          ...prev,
          ...data,
          sale_price: data.sale_price ?? '',
          purchase_price: data.purchase_price ?? '',
          stock_qty: data.stock_qty ?? 0,
          gst_rate: data.gst_rate ?? 18,
        }));
      } catch (err) {
        toast.error('Failed to load product');
        navigate('/products');
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [id, isEdit, navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function validate() {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Product name is required';
    if (!form.sale_price || Number(form.sale_price) <= 0) {
      newErrors.sale_price = 'Sale price must be greater than 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...form,
      sale_price: Number(form.sale_price) || 0,
      purchase_price: Number(form.purchase_price) || 0,
      gst_rate: Number(form.gst_rate),
      stock_qty: Number(form.stock_qty) || 0,
    };

    try {
      setSaving(true);
      if (isEdit) {
        await api.put(`/products/${id}`, payload);
        toast.success('Product updated successfully');
      } else {
        await api.post('/products', payload);
        toast.success('Product created successfully');
      }
      navigate('/products');
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading product..." />;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/products')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="page-header mb-0">{isEdit ? 'Edit Product' : 'New Product'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Product Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={`input-field ${errors.name ? 'border-red-400' : ''}`}
                placeholder="Enter product name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* HSN/SAC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
              <input
                type="text"
                name="hsn_sac"
                value={form.hsn_sac}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., 8471 or 9983"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="select-field"
              >
                <option value="goods">Goods</option>
                <option value="services">Services</option>
              </select>
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="select-field"
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            {/* GST Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
              <select
                name="gst_rate"
                value={form.gst_rate}
                onChange={handleChange}
                className="select-field"
              >
                {GST_RATES.map((rate) => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </select>
            </div>

            {/* Sale Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sale Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="sale_price"
                value={form.sale_price}
                onChange={handleChange}
                min="0"
                step="0.01"
                className={`input-field ${errors.sale_price ? 'border-red-400' : ''}`}
                placeholder="0.00"
              />
              {errors.sale_price && <p className="text-xs text-red-500 mt-1">{errors.sale_price}</p>}
            </div>

            {/* Purchase Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
              <input
                type="number"
                name="purchase_price"
                value={form.purchase_price}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="input-field"
                placeholder="0.00"
              />
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
              <input
                type="number"
                name="stock_qty"
                value={form.stock_qty}
                onChange={handleChange}
                min="0"
                step="1"
                className="input-field"
                placeholder="0"
              />
              {form.type === 'services' && (
                <p className="text-xs text-gray-400 mt-1">Stock tracking is not applicable for services.</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/products')} className="btn-secondary">
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
                {isEdit ? 'Update Product' : 'Create Product'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
