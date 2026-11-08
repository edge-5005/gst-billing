import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import {
  formatDateInput,
  getToday,
  STATE_CODES,
  GST_RATES,
  UNITS,
  calculateItemTotals,
  calculateInvoiceTotals,
  formatCurrency,
} from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

const emptyItem = {
  product_id: '',
  description: '',
  hsn_code: '',
  quantity: 1,
  unit: 'PCS',
  rate: 0,
  discount: 0,
  gst_rate: 18,
};

export default function QuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [companyState, setCompanyState] = useState('');

  const [form, setForm] = useState({
    quotation_number: '',
    quotation_date: getToday(),
    valid_until: '',
    customer_id: '',
    place_of_supply: '',
    notes: '',
    terms: '',
  });

  const [items, setItems] = useState([{ ...emptyItem }]);

  // Set valid_until to 30 days from today by default
  useEffect(() => {
    if (!isEdit && !form.valid_until) {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      const validUntil = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      setForm((prev) => ({ ...prev, valid_until: validUntil }));
    }
  }, [isEdit, form.valid_until]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [customersData, productsData] = await Promise.all([
          api.get('/customers'),
          api.get('/products'),
        ]);
        setCustomers(customersData);
        setProducts(productsData);

        // Fetch company details for state comparison
        try {
          const company = await api.get('/company');
          setCompanyState(company.state_code || '');
        } catch {
          // Company may not exist yet
        }

        if (isEdit) {
          const quotation = await api.get(`/quotations/${id}`);
          setForm({
            quotation_number: quotation.quotation_number || '',
            quotation_date: formatDateInput(quotation.quotation_date) || getToday(),
            valid_until: formatDateInput(quotation.valid_until) || '',
            customer_id: quotation.customer_id || '',
            place_of_supply: quotation.place_of_supply || '',
            notes: quotation.notes || '',
            terms: quotation.terms || '',
          });
          if (quotation.items && quotation.items.length > 0) {
            setItems(
              quotation.items.map((item) => ({
                product_id: item.product_id || '',
                description: item.description || '',
                hsn_code: item.hsn_code || '',
                quantity: item.quantity || 1,
                unit: item.unit || 'PCS',
                rate: item.rate || 0,
                discount: item.discount || 0,
                gst_rate: item.gst_rate ?? 18,
              }))
            );
          }
        }
      } catch (err) {
        toast.error('Failed to load data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = (e) => {
    const customerId = e.target.value;
    const customer = customers.find((c) => String(c.id) === String(customerId));
    setForm((prev) => ({
      ...prev,
      customer_id: customerId,
      place_of_supply: customer?.state_code || prev.place_of_supply,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find((p) => String(p.id) === String(productId));
    if (product) {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          product_id: product.id,
          description: product.name,
          hsn_code: product.hsn_code || '',
          rate: product.selling_price || 0,
          unit: product.unit || 'PCS',
          gst_rate: product.gst_rate ?? 18,
        };
        return updated;
      });
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyItem }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) {
      toast.warning('At least one item is required');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate if interstate
  const isInterState = form.place_of_supply && companyState && form.place_of_supply !== companyState;
  const totals = calculateInvoiceTotals(items, isInterState);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customer_id) {
      toast.error('Please select a customer');
      return;
    }
    if (!form.quotation_date) {
      toast.error('Please enter a quotation date');
      return;
    }
    const validItems = items.filter(
      (item) => item.description && Number(item.quantity) > 0 && Number(item.rate) > 0
    );
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        items: validItems.map((item) => {
          const itemTotals = calculateItemTotals(item, isInterState);
          return { ...item, ...itemTotals };
        }),
        subtotal: totals.subtotal,
        total_cgst: totals.total_cgst,
        total_sgst: totals.total_sgst,
        total_igst: totals.total_igst,
        total_discount: totals.total_discount,
        grand_total: totals.grand_total,
        round_off: totals.round_off,
        total_payable: totals.total_payable,
      };

      if (isEdit) {
        await api.put(`/quotations/${id}`, payload);
        toast.success('Quotation updated successfully');
      } else {
        await api.post('/quotations', payload);
        toast.success('Quotation created successfully');
      }
      navigate('/quotations');
    } catch (err) {
      toast.error('Failed to save quotation: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading quotation data..." />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/quotations')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="page-header mb-0">
          {isEdit ? 'Edit Quotation' : 'New Quotation'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Details */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quotation Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quotation Number
              </label>
              <input
                type="text"
                name="quotation_number"
                value={form.quotation_number}
                onChange={handleFormChange}
                className="input-field"
                placeholder="Auto-generated"
                readOnly={!isEdit}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quotation Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="quotation_date"
                value={form.quotation_date}
                onChange={handleFormChange}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until
              </label>
              <input
                type="date"
                name="valid_until"
                value={form.valid_until}
                onChange={handleFormChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={form.customer_id}
                onChange={handleCustomerChange}
                className="select-field"
                required
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gstin ? `(${c.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Place of Supply
              </label>
              <select
                name="place_of_supply"
                value={form.place_of_supply}
                onChange={handleFormChange}
                className="select-field"
              >
                <option value="">Select State</option>
                {Object.entries(STATE_CODES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} - {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Items</h2>
            <button type="button" onClick={addItem} className="btn-primary text-sm">
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 w-24">HSN</th>
                  <th className="px-3 py-2 w-20">Qty</th>
                  <th className="px-3 py-2 w-20">Unit</th>
                  <th className="px-3 py-2 w-24">Rate</th>
                  <th className="px-3 py-2 w-20">Disc %</th>
                  <th className="px-3 py-2 w-20">GST %</th>
                  <th className="px-3 py-2 w-28 text-right">Amount</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const itemTotals = calculateItemTotals(item, isInterState);
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={item.product_id}
                          onChange={(e) => handleProductSelect(index, e.target.value)}
                          className="select-field text-sm"
                        >
                          <option value="">Select</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="input-field text-sm"
                          placeholder="Item description"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.hsn_code}
                          onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                          className="input-field text-sm"
                          placeholder="HSN"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="input-field text-sm text-right"
                          min="0"
                          step="any"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="select-field text-sm"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          className="input-field text-sm text-right"
                          min="0"
                          step="any"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                          className="input-field text-sm text-right"
                          min="0"
                          max="100"
                          step="any"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={item.gst_rate}
                          onChange={(e) => handleItemChange(index, 'gst_rate', e.target.value)}
                          className="select-field text-sm"
                        >
                          {GST_RATES.map((r) => (
                            <option key={r} value={r}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                        {formatCurrency(itemTotals.total)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Notes & Terms */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes & Terms</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows="3"
                  className="input-field"
                  placeholder="Any notes for the customer..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  name="terms"
                  value={form.terms}
                  onChange={handleFormChange}
                  rows="3"
                  className="input-field"
                  placeholder="Terms and conditions..."
                />
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.total_discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(totals.total_discount)}
                  </span>
                </div>
              )}
              {!isInterState ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">CGST</span>
                    <span className="font-medium">{formatCurrency(totals.total_cgst)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">SGST</span>
                    <span className="font-medium">{formatCurrency(totals.total_sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IGST</span>
                  <span className="font-medium">{formatCurrency(totals.total_igst)}</span>
                </div>
              )}
              {totals.round_off !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Round Off</span>
                  <span className="font-medium">{formatCurrency(totals.round_off)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="text-base font-semibold text-gray-900">Total Payable</span>
                <span className="text-base font-bold text-primary-600">
                  {formatCurrency(totals.total_payable)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/quotations')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Quotation' : 'Save Quotation'}
          </button>
        </div>
      </form>
    </div>
  );
}
