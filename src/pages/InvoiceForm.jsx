import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, FileText, CheckCircle2 } from 'lucide-react';
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
import { INVOICE_TYPES } from '../utils/constants';
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

export default function InvoiceForm({ type: initialType }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);

  const determineType = () => {
    if (initialType) return initialType;
    if (location.pathname.includes('/bill-of-supply')) return 'bill_of_supply';
    if (location.pathname.includes('/credit-notes')) return 'credit_note';
    if (location.pathname.includes('/debit-notes')) return 'debit_note';
    return 'tax_invoice';
  };

  const [invoiceType, setInvoiceType] = useState(determineType());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState({});
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);

  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: getToday(),
    due_date: getToday(),
    customer_id: '',
    reference_invoice_id: '',
    place_of_supply: '',
    place_of_supply_code: '',
    is_reverse_charge: false,
    notes: 'Thank you for your business!',
    terms: '1. Payment due within 15 days.\n2. Goods once sold will not be taken back.',
    reason: '',
  });

  const [items, setItems] = useState([{ ...emptyItem }]);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [compRes, custRes, prodRes] = await Promise.all([
          api.get('/company').catch(() => ({})),
          api.get('/customers').catch(() => []),
          api.get('/products').catch(() => []),
        ]);

        setCompany(compRes || {});
        setCustomers(custRes || []);
        setProducts(prodRes || []);

        if (isEdit) {
          const inv = await api.get(`/invoices/${id}`);
          setInvoiceType(inv.invoice_type);
          setFormData({
            invoice_number: inv.invoice_number,
            invoice_date: formatDateInput(inv.invoice_date),
            due_date: formatDateInput(inv.due_date),
            customer_id: inv.customer_id,
            reference_invoice_id: inv.reference_invoice_id || '',
            place_of_supply: inv.place_of_supply || '',
            place_of_supply_code: inv.place_of_supply_code || '',
            is_reverse_charge: Boolean(inv.is_reverse_charge),
            notes: inv.notes || '',
            terms: inv.terms || '',
            reason: inv.reason || '',
          });

          if (inv.items && inv.items.length > 0) {
            setItems(
              inv.items.map((it) => ({
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
        } else {
          // Fetch next invoice number
          try {
            const nextRes = await api.get(`/invoices/next-number/${invoiceType}`);
            setFormData((prev) => ({
              ...prev,
              invoice_number: nextRes.next_number || '',
            }));
          } catch (e) {
            console.error('Error getting next number', e);
          }
        }
      } catch (err) {
        toast.error('Failed to load form data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEdit, invoiceType]);

  // Load customer invoices for reference in credit/debit notes
  useEffect(() => {
    if (formData.customer_id && (invoiceType === 'credit_note' || invoiceType === 'debit_note')) {
      api.get(`/invoices?customer_id=${formData.customer_id}&type=tax_invoice`)
        .then((data) => setCustomerInvoices(data || []))
        .catch(() => setCustomerInvoices([]));
    }
  }, [formData.customer_id, invoiceType]);

  // Auto-fill place of supply when customer changes
  const handleCustomerChange = (e) => {
    const custId = parseInt(e.target.value, 10);
    const selectedCust = customers.find((c) => c.id === custId);
    if (selectedCust) {
      const stateCode = selectedCust.billing_state_code || '';
      const stateName = selectedCust.billing_state || STATE_CODES[stateCode] || '';
      setFormData((prev) => ({
        ...prev,
        customer_id: custId,
        place_of_supply: stateName,
        place_of_supply_code: stateCode,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        customer_id: '',
      }));
    }
  };

  // Check if inter-state (IGST)
  const isInterState = useMemo(() => {
    if (!formData.place_of_supply_code || !company.state_code) return false;
    return formData.place_of_supply_code !== company.state_code;
  }, [formData.place_of_supply_code, company.state_code]);

  // Handle Item row updates
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === 'product_id') {
      const prod = products.find((p) => p.id === parseInt(value, 10));
      if (prod) {
        item.description = prod.name;
        item.hsn_sac = prod.hsn_sac || '';
        item.unit = prod.unit || 'PCS';
        item.rate = prod.sale_price || 0;
        item.gst_rate = invoiceType === 'bill_of_supply' ? 0 : (prod.gst_rate ?? 18);
      }
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        ...emptyItem,
        gst_rate: invoiceType === 'bill_of_supply' ? 0 : 18,
      },
    ]);
  };

  const removeItem = (index) => {
    if (items.length === 1) {
      toast.warning('At least one item is required');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate Totals
  const calculated = useMemo(() => {
    const adjustedItems = items.map((it) => ({
      ...it,
      gst_rate: invoiceType === 'bill_of_supply' ? 0 : Number(it.gst_rate) || 0,
    }));
    return calculateInvoiceTotals(adjustedItems, isInterState);
  }, [items, isInterState, invoiceType]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    if (!formData.invoice_date) {
      toast.error('Please select an invoice date');
      return;
    }

    const validItems = items.filter(
      (item) => item.description.trim() && Number(item.quantity) > 0 && Number(item.rate) >= 0
    );

    if (validItems.length === 0) {
      toast.error('Please enter at least one valid line item with description, quantity, and rate');
      return;
    }

    try {
      setSaving(true);

      const payloadItems = validItems.map((item) => {
        const itemTotals = calculateItemTotals(
          {
            ...item,
            gst_rate: invoiceType === 'bill_of_supply' ? 0 : Number(item.gst_rate) || 0,
          },
          isInterState
        );
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
          gst_rate: invoiceType === 'bill_of_supply' ? 0 : Number(item.gst_rate) || 0,
          cgst_amount: invoiceType === 'bill_of_supply' ? 0 : itemTotals.cgst_amount,
          sgst_amount: invoiceType === 'bill_of_supply' ? 0 : itemTotals.sgst_amount,
          igst_amount: invoiceType === 'bill_of_supply' ? 0 : itemTotals.igst_amount,
          total: itemTotals.total,
        };
      });

      const totalTax = invoiceType === 'bill_of_supply'
        ? 0
        : (calculated.total_cgst + calculated.total_sgst + calculated.total_igst);

      const payload = {
        invoice_number: formData.invoice_number,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        customer_id: parseInt(formData.customer_id, 10),
        invoice_type: invoiceType,
        reference_invoice_id: formData.reference_invoice_id ? parseInt(formData.reference_invoice_id, 10) : null,
        place_of_supply: formData.place_of_supply,
        place_of_supply_code: formData.place_of_supply_code,
        is_reverse_charge: formData.is_reverse_charge ? 1 : 0,
        subtotal: calculated.subtotal,
        discount_amount: calculated.total_discount,
        cgst_total: invoiceType === 'bill_of_supply' ? 0 : calculated.total_cgst,
        sgst_total: invoiceType === 'bill_of_supply' ? 0 : calculated.total_sgst,
        igst_total: invoiceType === 'bill_of_supply' ? 0 : calculated.total_igst,
        total_tax: totalTax,
        grand_total: calculated.grand_total,
        notes: formData.notes,
        terms: formData.terms,
        reason: formData.reason,
        items: payloadItems,
      };

      if (isEdit) {
        await api.put(`/invoices/${id}`, payload);
        toast.success('Invoice updated successfully');
        navigate(`/invoices/${id}`);
      } else {
        const res = await api.post('/invoices', payload);
        toast.success('Invoice created successfully');
        navigate(`/invoices/${res.id || ''}`);
      }
    } catch (err) {
      toast.error('Failed to save invoice: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading invoice form..." />;

  const invoiceTitle = INVOICE_TYPES[invoiceType] || 'Tax Invoice';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? `Edit ${invoiceTitle}` : `New ${invoiceTitle}`}
            </h1>
            <p className="text-sm text-gray-500">
              {invoiceType === 'tax_invoice' && 'Generate a standard GST compliant sales invoice'}
              {invoiceType === 'bill_of_supply' && 'For exempt goods or composition scheme transactions'}
              {invoiceType === 'credit_note' && 'Issue credit adjustment for an existing invoice'}
              {invoiceType === 'debit_note' && 'Issue debit adjustment for an existing invoice'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
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
            {saving ? 'Saving...' : 'Save Invoice'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Metadata Card */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={formData.invoice_number}
                readOnly
                className="input-field bg-gray-50 font-mono font-medium text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.customer_id}
                onChange={handleCustomerChange}
                className="select-field"
              >
                <option value="">-- Select Customer --</option>
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
                value={formData.place_of_supply_code}
                onChange={(e) => {
                  const code = e.target.value;
                  setFormData({
                    ...formData,
                    place_of_supply_code: code,
                    place_of_supply: STATE_CODES[code] || '',
                  });
                }}
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

            <div className="flex items-center pt-6">
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.is_reverse_charge}
                  onChange={(e) => setFormData({ ...formData, is_reverse_charge: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                Applicable Reverse Charge
              </label>
            </div>

            {(invoiceType === 'credit_note' || invoiceType === 'debit_note') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original Invoice Ref
                  </label>
                  <select
                    value={formData.reference_invoice_id}
                    onChange={(e) => setFormData({ ...formData, reference_invoice_id: e.target.value })}
                    className="select-field"
                  >
                    <option value="">-- Select Reference Invoice --</option>
                    {customerInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} ({inv.invoice_date}) - {formatCurrency(inv.grand_total)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sales return, rate difference"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="input-field"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800 flex items-center justify-between">
            <span>
              Company State: <strong>{company.state || 'Not set'} ({company.state_code || '--'})</strong>
            </span>
            <span>
              Supply Type: <strong>{isInterState ? 'Inter-state (IGST applicable)' : 'Intra-state (CGST + SGST applicable)'}</strong>
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Items & Services</h2>
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
                <th className="p-3 min-w-[220px]">Product / Service</th>
                <th className="p-3 w-28">HSN/SAC</th>
                <th className="p-3 w-24">Qty</th>
                <th className="p-3 w-24">Unit</th>
                <th className="p-3 w-32">Rate (₹)</th>
                <th className="p-3 w-24">Disc %</th>
                <th className="p-3 w-32">Taxable (₹)</th>
                {invoiceType !== 'bill_of_supply' && (
                  <>
                    <th className="p-3 w-28">GST Rate</th>
                    <th className="p-3 w-28 text-right">Tax (₹)</th>
                  </>
                )}
                <th className="p-3 w-36 text-right">Total (₹)</th>
                <th className="p-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => {
                const rowTotals = calculateItemTotals(
                  {
                    ...item,
                    gst_rate: invoiceType === 'bill_of_supply' ? 0 : Number(item.gst_rate) || 0,
                  },
                  isInterState
                );

                const itemTax = isInterState ? rowTotals.igst_amount : (rowTotals.cgst_amount + rowTotals.sgst_amount);

                return (
                  <tr key={index} className="hover:bg-gray-50/50">
                    <td className="p-3 text-center text-gray-400 font-mono text-xs">
                      {index + 1}
                    </td>

                    <td className="p-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        className="select-field text-xs mb-1"
                      >
                        <option value="">-- Choose Product / Service --</option>
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

                    {invoiceType !== 'bill_of_supply' && (
                      <>
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
                      </>
                    )}

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

        {/* Summary and Terms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notes and Terms */}
          <div className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes / Remarks
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field text-sm"
                placeholder="Additional notes for the client..."
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
                placeholder="Payment and warranty conditions..."
              />
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="card bg-gray-50/50 space-y-3">
            <h3 className="text-base font-semibold text-gray-900 pb-2 border-b border-gray-200">
              Payment Summary
            </h3>

            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal (Taxable Amount):</span>
              <span className="font-medium text-gray-900">{formatCurrency(calculated.subtotal)}</span>
            </div>

            {calculated.total_discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Total Discount:</span>
                <span>-{formatCurrency(calculated.total_discount)}</span>
              </div>
            )}

            {invoiceType !== 'bill_of_supply' && (
              <>
                {isInterState ? (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Integrated GST (IGST):</span>
                    <span className="font-medium text-gray-900">{formatCurrency(calculated.total_igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Central GST (CGST):</span>
                      <span className="font-medium text-gray-900">{formatCurrency(calculated.total_cgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>State GST (SGST):</span>
                      <span className="font-medium text-gray-900">{formatCurrency(calculated.total_sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-medium text-gray-700 pt-1 border-t border-dashed border-gray-200">
                  <span>Total Tax Amount:</span>
                  <span>
                    {formatCurrency(calculated.total_cgst + calculated.total_sgst + calculated.total_igst)}
                  </span>
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
