import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Printer,
  Edit,
  Trash2,
  CreditCard,
  Building2,
  FileCheck,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  getToday,
  numberToWords
} from '../utils/helpers';
import { INVOICE_TYPES, INVOICE_STATUSES, PAYMENT_MODES } from '../utils/constants';
import StatusBadge from '../components/StatusBadge';
import DeleteModal from '../components/DeleteModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { generateInvoicePdf } from '../pdf/invoicePdf';

export default function InvoiceView() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Payment modal state
  const [paymentData, setPaymentData] = useState({
    payment_date: getToday(),
    amount: '',
    payment_mode: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, compData] = await Promise.all([
        api.get(`/invoices/${id}`),
        api.get('/company').catch(() => ({})),
      ]);
      setInvoice(invData);
      setCompany(compData || {});
      setPaymentData((prev) => ({
        ...prev,
        amount: Math.max(0, (invData.grand_total || 0) - (invData.amount_paid || 0)),
      }));
    } catch (err) {
      toast.error('Failed to load invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = async () => {
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted successfully');
      navigate('/invoices');
    } catch (err) {
      toast.error('Failed to delete invoice: ' + err.message);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!invoice) return;
    try {
      generateInvoicePdf(invoice, company);
      toast.success('Generating PDF...');
    } catch (err) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentData.amount || Number(paymentData.amount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    try {
      await api.post('/payments', {
        invoice_id: parseInt(id, 10),
        payment_date: paymentData.payment_date,
        amount: Number(paymentData.amount),
        payment_mode: paymentData.payment_mode,
        reference_number: paymentData.reference_number,
        notes: paymentData.notes,
      });
      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to record payment: ' + err.message);
    }
  };

  if (loading) return <LoadingSpinner message="Loading invoice details..." />;
  if (!invoice) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Invoice Not Found</h2>
        <p className="text-gray-500 mt-1 mb-4">The invoice you requested could not be located.</p>
        <Link to="/invoices" className="btn-primary">
          Back to Invoices
        </Link>
      </div>
    );
  }

  const isInterState = invoice.place_of_supply_code && company.state_code
    ? invoice.place_of_supply_code !== company.state_code
    : false;

  const dueAmount = Math.max(0, (invoice.grand_total || 0) - (invoice.amount_paid || 0));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} statusMap={INVOICE_STATUSES} />
            </div>
            <p className="text-sm text-gray-500">
              {INVOICE_TYPES[invoice.invoice_type] || 'Tax Invoice'} • Created on {formatDate(invoice.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dueAmount > 0 && invoice.invoice_type === 'tax_invoice' && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn-success text-sm"
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </button>
          )}

          <button
            onClick={handleDownloadPdf}
            className="btn-primary text-sm"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>

          <button
            onClick={handlePrint}
            className="btn-secondary text-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          <Link
            to={`/invoices/${id}/edit`}
            className="btn-secondary text-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete Invoice"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Printable Document Card */}
      <div className="card p-8 bg-white border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0">
        {/* Header: Company & Invoice Info */}
        <div className="flex flex-col md:flex-row justify-between pb-6 border-b border-gray-200 gap-6">
          <div>
            <h2 className="text-2xl font-bold text-primary-900 mb-1">
              {company.name || 'Your Company Name'}
            </h2>
            <div className="text-sm text-gray-600 space-y-0.5">
              {company.address && <p>{company.address}</p>}
              <p>
                {[company.city, company.state, company.pincode].filter(Boolean).join(', ')}
              </p>
              {company.gstin && (
                <p>
                  <strong>GSTIN:</strong> {company.gstin}
                </p>
              )}
              {company.pan && (
                <p>
                  <strong>PAN:</strong> {company.pan}
                </p>
              )}
              {company.phone && <p><strong>Phone:</strong> {company.phone}</p>}
              {company.email && <p><strong>Email:</strong> {company.email}</p>}
            </div>
          </div>

          <div className="text-right flex flex-col justify-between">
            <div>
              <span className="inline-block px-3 py-1 bg-primary-100 text-primary-800 text-xs font-bold uppercase rounded tracking-wider mb-2">
                {INVOICE_TYPES[invoice.invoice_type] || 'TAX INVOICE'}
              </span>
              <p className="text-lg font-bold text-gray-900 font-mono">
                {invoice.invoice_number}
              </p>
            </div>

            <div className="text-sm text-gray-600 space-y-0.5 mt-3">
              <p>
                <strong>Invoice Date:</strong> {formatDate(invoice.invoice_date)}
              </p>
              {invoice.due_date && (
                <p>
                  <strong>Due Date:</strong> {formatDate(invoice.due_date)}
                </p>
              )}
              {invoice.place_of_supply && (
                <p>
                  <strong>Place of Supply:</strong> {invoice.place_of_supply}{' '}
                  {invoice.place_of_supply_code ? `(${invoice.place_of_supply_code})` : ''}
                </p>
              )}
              <p>
                <strong>Reverse Charge:</strong> {invoice.is_reverse_charge ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>

        {/* Bill To & Ship To */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b border-gray-200">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Bill To:
            </h3>
            <p className="text-base font-bold text-gray-900">{invoice.customer_name}</p>
            <div className="text-sm text-gray-600 space-y-0.5 mt-1">
              {invoice.billing_address && <p>{invoice.billing_address}</p>}
              <p>
                {[invoice.billing_city, invoice.billing_state, invoice.billing_pincode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {invoice.customer_gstin && (
                <p>
                  <strong>GSTIN:</strong> {invoice.customer_gstin}
                </p>
              )}
              {invoice.customer_phone && <p><strong>Phone:</strong> {invoice.customer_phone}</p>}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Ship To:
            </h3>
            <p className="text-base font-bold text-gray-900">{invoice.customer_name}</p>
            <div className="text-sm text-gray-600 space-y-0.5 mt-1">
              {invoice.shipping_address ? (
                <>
                  <p>{invoice.shipping_address}</p>
                  <p>
                    {[invoice.shipping_city, invoice.shipping_state, invoice.shipping_pincode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </>
              ) : (
                <p className="text-gray-400 italic">Same as billing address</p>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-gray-700 bg-gray-50">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 w-24">HSN/SAC</th>
                <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                <th className="py-2.5 px-3 w-24 text-right">Rate</th>
                {invoice.invoice_type !== 'bill_of_supply' && (
                  <>
                    <th className="py-2.5 px-3 w-28 text-right">Taxable</th>
                    <th className="py-2.5 px-3 w-20 text-right">GST %</th>
                    <th className="py-2.5 px-3 w-24 text-right">Tax</th>
                  </>
                )}
                <th className="py-2.5 px-3 w-32 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(invoice.items || []).map((item, idx) => {
                const tax = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
                return (
                  <tr key={item.id || idx}>
                    <td className="py-3 px-3 text-center text-gray-400 text-xs">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-gray-900">{item.description}</p>
                      {item.product_name && item.product_name !== item.description && (
                        <p className="text-xs text-gray-400">{item.product_name}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-gray-600">{item.hsn_sac || '-'}</td>
                    <td className="py-3 px-3 text-right">
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td className="py-3 px-3 text-right">{formatCurrency(item.rate)}</td>
                    {invoice.invoice_type !== 'bill_of_supply' && (
                      <>
                        <td className="py-3 px-3 text-right">{formatCurrency(item.taxable_amount)}</td>
                        <td className="py-3 px-3 text-right">{item.gst_rate}%</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(tax)}</td>
                      </>
                    )}
                    <td className="py-3 px-3 text-right font-semibold text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
          <div>
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 mb-4">
              <span className="font-semibold text-gray-700 block mb-0.5">Total Amount in Words:</span>
              <p className="font-medium text-gray-900">{numberToWords(invoice.grand_total)}</p>
            </div>

            {/* Bank details */}
            {company.bank_name && (
              <div className="p-3 border border-gray-200 rounded-lg text-xs space-y-1">
                <p className="font-semibold text-gray-800 flex items-center gap-1.5 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-primary-600" />
                  Bank Details for Payment
                </p>
                <p><strong>Bank:</strong> {company.bank_name}</p>
                <p><strong>A/C No:</strong> {company.bank_account}</p>
                <p><strong>IFSC:</strong> {company.bank_ifsc}</p>
                {company.bank_branch && <p><strong>Branch:</strong> {company.bank_branch}</p>}
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</span>
            </div>

            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(invoice.discount_amount)}</span>
              </div>
            )}

            {invoice.invoice_type !== 'bill_of_supply' && (
              <>
                {isInterState ? (
                  <div className="flex justify-between text-gray-600">
                    <span>IGST:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.igst_total)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>CGST:</span>
                      <span className="font-medium text-gray-900">{formatCurrency(invoice.cgst_total)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>SGST:</span>
                      <span className="font-medium text-gray-900">{formatCurrency(invoice.sgst_total)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-gray-600 border-t border-dashed border-gray-200 pt-1">
                  <span>Total Tax:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(invoice.total_tax)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
              <span>Grand Total:</span>
              <span className="text-primary-700">{formatCurrency(invoice.grand_total)}</span>
            </div>

            <div className="flex justify-between text-sm text-gray-600 pt-1">
              <span>Amount Paid:</span>
              <span className="font-medium text-green-600">{formatCurrency(invoice.amount_paid || 0)}</span>
            </div>

            <div className="flex justify-between text-base font-semibold text-gray-900 pt-1 border-t border-gray-200">
              <span>Balance Due:</span>
              <span className={dueAmount > 0 ? 'text-red-600' : 'text-gray-900'}>
                {formatCurrency(dueAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Terms and Signatures */}
        <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-500">
          <div>
            {invoice.terms && (
              <div className="mb-3">
                <span className="font-semibold text-gray-700 block mb-1">Terms & Conditions:</span>
                <p className="whitespace-pre-line text-gray-600">{invoice.terms}</p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Notes:</span>
                <p className="whitespace-pre-line text-gray-600">{invoice.notes}</p>
              </div>
            )}
          </div>

          <div className="text-right flex flex-col justify-end">
            <p className="text-gray-700 font-semibold mb-12">
              For {company.name || 'Authorized Signatory'}
            </p>
            <p className="text-gray-400">Authorized Signature</p>
          </div>
        </div>
      </div>

      {/* Payment History Section */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="card no-print">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            Payment History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Payment Mode</th>
                  <th className="p-3">Reference No</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 font-medium text-gray-800">{formatDate(p.payment_date)}</td>
                    <td className="p-3 capitalize">{p.payment_mode?.replace('_', ' ')}</td>
                    <td className="p-3 font-mono text-xs">{p.reference_number || '-'}</td>
                    <td className="p-3 text-gray-500">{p.notes || '-'}</td>
                    <td className="p-3 text-right font-semibold text-green-600">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={dueAmount}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="input-field"
                />
                <span className="text-xs text-gray-500 mt-1 block">
                  Remaining Due: {formatCurrency(dueAmount)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentData.payment_mode}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
                  className="select-field"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reference / Transaction No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR12345678"
                  value={paymentData.reference_number}
                  onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-success text-sm">
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
