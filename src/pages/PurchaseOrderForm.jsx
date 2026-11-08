import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import {
  formatCurrency,
  formatDateInput,
  getToday,
  STATE_CODES,
  GST_RATES,
  UNITS,
  calculateItemTotals,
  calculateInvoiceTotals,
  numberToWords,
} from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

const emptyItem = {
  product_id: '',
  description: '',
  hsn_sac: '',
  quantity: 1,
  unit: 'PCS',
  rate: 0,
  discount: 0,
  gst_rate: 18,
};

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [formData, setFormData] = useState({
    po_number: '',
    po_date: getToday(),
    expected_date: '',
    supplier_id: '',
    notes: 'Please ship all items in good condition.',
    terms: '1. Delivery within promised schedule.\n2. Invoices must reference this PO number.',
  });

  const [selectedSupplierState, setSelectedSupplierState] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [compRes, supRes, prodRes] = await Promise.all([
          api.get('/company').catch(() => ({})),
          api.get('/suppliers').catch(() => []),
          api.get('/products').catch(() => []),
        ]);

        setCompany(compRes || {});
        setSuppliers(supRes || []);
        setProducts(prodRes || []);

        if (isEdit) {
          const po = await api.get(`/purchase-orders/${id}`);
          setFormData({
            po_number: po.po_number,
            po_date: formatDateInput(po.po_date),
            expected_date: formatDateInput(po.expected_date),
            supplier_id: po.supplier_id,
            notes: po.notes || '',
            terms: po.terms || '',
          });
          setSelectedSupplierState(po.supplier_state_code || '');

          if (po.items && po.items.length > 0) {
            setItems(
              po.items.map((it) => ({
                product_id: it.product_id || '',
                description: it.description || '',
                hsn_sac: it.hsn_sac || '',
                quantity: it.quantity || 1,
                unit: it.unit || 'PCS',
                rate: it.rate || 0,
                discount: it.discount_percent || 0,
                gst_rate: it.gst_rate || 0,
              }))
            );
          }
        }
      } catch (err) {
        toast.error('Failed to load purchase order data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEdit]);

  const handleSupplierChange = (e) => {
    const sId = parseInt(e.target.value, 10);
    const sup = suppliers.find((s) => s.id === sId);
    setFormData((prev) => ({ ...prev, supplier_id: sId }));
    setSelectedSupplierState(sup ? (sup.state_code || '') : '');
  };

  const isInterState = useMemo(() => {
    if (!selectedSupplierState || !company.state_code) return false;
    return selectedSupplierState !== company.state_code;
  }, [selectedSupplierState, company.state_code]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === 'product_id') {
      const prod = products.find((p) => p.id === parseInt(value, 10));
      if (prod) {
        item.description = prod.name;
        item.hsn_sac = prod.hsn_sac || '';
        item.unit = prod.unit || 'PCS';
        item.rate = prod.purchase_price || prod.sale_price || 0;
        item.gst_rate = prod.gst_rate ?? 18;
      }
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyItem }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) {
      toast.warning('At least one item is required');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const calculated = useMemo(() => {
    return calculateInvoiceTotals(items, isInterState);
  }, [items, isInterState]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.supplier_id) {
      toast.error('Please select a supplier');
      return;
    }

    const validItems = items.filter(
      (it) => it.description.trim() && Number(it.quantity) > 0 && Number(it.rate) >= 0
    );

    if (validItems.length === 0) {
      toast.error('Please enter at least one item with valid description, quantity, and rate');
      return;
    }

    try {
      setSaving(true);
      const payloadItems = validItems.map((item) => {
        const itemTotals = calculateItemTotals(item, isInterState);
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const disc = Number(item.discount) || 0;
        const discAmount = (qty * rate * disc) / 100;

        return {
          product_id: item.product_id ? parseInt(item.product_id, 10) : null,
          description: item.description,
          hsn_sac: item.hsn_sac,
          quantity: qty,
          unit: item.unit,
          rate: rate,
          discount_percent: disc,
          discount_amount: discAmount,
          taxable_amount: itemTotals.taxable_amount,
          gst_rate: Number(item.gst_rate) || 0,
          cgst_amount: itemTotals.cgst_amount,
          sgst_amount: itemTotals.sgst_amount,
          igst_amount: itemTotals.igst_amount,
          total: itemTotals.total,
        };
      });

      const payload = {
        po_date: formData.po_date,
        expected_date: formData.expected_date,
        supplier_id: parseInt(formData.supplier_id, 10),
        subtotal: calculated.subtotal,
        discount_amount: calculated.total_discount,
        cgst_total: calculated.total_cgst,
        sgst_total: calculated.total_sgst,
        igst_total: calculated.total_igst,
        total_tax: calculated.total_cgst + calculated.total_sgst + calculated.total_igst,
        grand_total: calculated.grand_total,
        notes: formData.notes,
        terms: formData.terms,
        items: payloadItems,
      };

      if (isEdit) {
        await api.put(`/purchase-orders/${id}`, payload);
        toast.success('Purchase order updated successfully');
        navigate(`/purchase-orders/${id}`);
      } else {
        const res = await api.post('/purchase-orders', payload);
        toast.success('Purchase order created successfully');
        navigate(`/purchase-orders/${res.id || ''}`);
      }
    } catch (err) {
      toast.error('Failed to save purchase order: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading purchase order form..." />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h1>
            <p className="text-sm text-gray-500">
              Issue an order to your supplier for products or materials
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.supplier_id}
                onChange={handleSupplierChange}
                className="select-field"
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.gstin ? `(${s.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PO Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.po_date}
                onChange={(e) => setFormData({ ...formData, po_date: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={formData.expected_date}
                onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                className="input-field"
              />
            </div>

            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Number
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.po_number}
                  className="input-field bg-gray-50 font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Ordered Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary text-sm py-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 bg-gray-50">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 min-w-[220px]">Product</th>
                <th className="p-3 w-28">HSN/SAC</th>
                <th className="p-3 w-24">Qty</th>
                <th className="p-3 w-24">Unit</th>
                <th className="p-3 w-32">Purchase Rate (₹)</th>
                <th className="p-3 w-24">Disc %</th>
                <th className="p-3 w-32">Taxable (₹)</th>
                <th className="p-3 w-28">GST Rate</th>
                <th className="p-3 w-28 text-right">Tax (₹)</th>
                <th className="p-3 w-36 text-right">Total (₹)</th>
                <th className="p-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => {
                const rowTotals = calculateItemTotals(item, isInterState);
                const itemTax = isInterState ? rowTotals.igst_amount : (rowTotals.cgst_amount + rowTotals.sgst_amount);

                return (
                  <tr key={index} className="hover:bg-gray-50/50">
                    <td className="p-3 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                    <td className="p-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        className="select-field text-xs mb-1"
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="input-field text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="HSN/SAC"
                        value={item.hsn_sac}
                        onChange={(e) => handleItemChange(index, 'hsn_sac', e.target.value)}
                        className="input-field text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="input-field text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="select-field text-xs"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        className="input-field text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={item.discount}
                        onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                        className="input-field text-xs text-right"
                      />
                    </td>
                    <td className="p-3 text-right font-medium text-gray-700">
                      {formatCurrency(rowTotals.taxable_amount)}
                    </td>
                    <td className="p-2">
                      <select
                        value={item.gst_rate}
                        onChange={(e) => handleItemChange(index, 'gst_rate', e.target.value)}
                        className="select-field text-xs"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right text-gray-700">
                      {formatCurrency(itemTax)}
                    </td>
                    <td className="p-3 text-right font-semibold text-gray-900">
                      {formatCurrency(rowTotals.total)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-gray-400 hover:text-red-500 transition"
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

        {/* Totals & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions / Notes
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terms and Conditions
              </label>
              <textarea
                rows={4}
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="input-field text-sm"
              />
            </div>
          </div>

          <div className="card bg-gray-50/50 space-y-3">
            <h3 className="text-base font-semibold text-gray-900 pb-2 border-b border-gray-200">
              Order Summary
            </h3>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal:</span>
              <span className="font-medium text-gray-900">{formatCurrency(calculated.subtotal)}</span>
            </div>
            {calculated.total_discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(calculated.total_discount)}</span>
              </div>
            )}
            {isInterState ? (
              <div className="flex justify-between text-sm text-gray-600">
                <span>IGST:</span>
                <span className="font-medium text-gray-900">{formatCurrency(calculated.total_igst)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>CGST:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(calculated.total_cgst)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>SGST:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(calculated.total_sgst)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-200">
              <span>Grand Total:</span>
              <span className="text-primary-700">{formatCurrency(calculated.grand_total)}</span>
            </div>
            <div className="pt-2 text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-200">
              <span className="font-semibold block mb-0.5">Amount in words:</span>
              {numberToWords(calculated.grand_total)}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
