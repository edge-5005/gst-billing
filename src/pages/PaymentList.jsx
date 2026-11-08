import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CreditCard, Trash2, Filter, DollarSign, Calendar, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getToday } from '../utils/helpers';
import { PAYMENT_MODES } from '../utils/constants';
import SearchBar from '../components/SearchBar';
import EmptyState from '../components/EmptyState';
import DeleteModal from '../components/DeleteModal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PaymentList() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [formData, setFormData] = useState({
    invoice_id: '',
    payment_date: getToday(),
    amount: '',
    payment_mode: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (modeFilter) params.append('payment_mode', modeFilter);

      const data = await api.get(`/payments?${params.toString()}`);
      setPayments(data || []);
    } catch (err) {
      toast.error('Failed to load payments: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnpaidInvoices = async () => {
    try {
      const data = await api.get('/invoices');
      // filter only unpaid or partial tax invoices
      const eligible = (data || []).filter(
        (inv) => (inv.status === 'unpaid' || inv.status === 'partial') && inv.invoice_type === 'tax_invoice'
      );
      setInvoices(eligible);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [modeFilter]);

  const handleOpenModal = () => {
    fetchUnpaidInvoices();
    setFormData({
      invoice_id: '',
      payment_date: getToday(),
      amount: '',
      payment_mode: 'bank_transfer',
      reference_number: '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleInvoiceSelect = (e) => {
    const invId = parseInt(e.target.value, 10);
    const selected = invoices.find((inv) => inv.id === invId);
    if (selected) {
      const due = Math.max(0, (selected.grand_total || 0) - (selected.amount_paid || 0));
      setFormData((prev) => ({
        ...prev,
        invoice_id: invId,
        amount: due > 0 ? due : '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        invoice_id: '',
        amount: '',
      }));
    }
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!formData.invoice_id) {
      toast.error('Please select an invoice');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await api.post('/payments', {
        invoice_id: parseInt(formData.invoice_id, 10),
        payment_date: formData.payment_date,
        amount: Number(formData.amount),
        payment_mode: formData.payment_mode,
        reference_number: formData.reference_number,
        notes: formData.notes,
      });
      toast.success('Payment recorded successfully');
      setShowModal(false);
      fetchPayments();
    } catch (err) {
      toast.error('Failed to record payment: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/payments/${deleteId}`);
      toast.success('Payment deleted successfully');
      setPayments(payments.filter((p) => p.id !== deleteId));
    } catch (err) {
      toast.error('Failed to delete payment: ' + err.message);
    } finally {
      setDeleteId(null);
    }
  };

  const totalCollected = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header mb-0">Payments Received</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track client payments and invoice reconciliations
          </p>
        </div>
        <button onClick={handleOpenModal} className="btn-primary">
          <Plus className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Received</p>
              <h3 className="text-2xl font-bold mt-1">{formatCurrency(totalCollected)}</h3>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Transactions</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{payments.length}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Average Payment</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(payments.length > 0 ? totalCollected / payments.length : 0)}
              </h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-60">
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="select-field text-sm"
            >
              <option value="">All Payment Modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8">
            <LoadingSpinner message="Loading payment records..." />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CreditCard}
              title="No Payments Recorded"
              description="Record payments received from customers against outstanding invoices."
              action={
                <button onClick={handleOpenModal} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Record Payment
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-header">
                <tr>
                  <th className="p-4">Payment Date</th>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4">Reference No.</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-700 font-medium">{formatDate(p.payment_date)}</td>
                    <td className="p-4 font-mono font-medium text-primary-600">
                      <Link to={`/invoices/${p.invoice_id}`} className="hover:underline">
                        {p.invoice_number}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-900">{p.customer_name}</td>
                    <td className="p-4">
                      <span className="capitalize px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
                        {p.payment_mode?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-500">
                      {p.reference_number || '-'}
                    </td>
                    <td className="p-4 text-right font-semibold text-green-600">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition"
                        title="Delete Payment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Record Customer Payment</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Select Invoice <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.invoice_id}
                  onChange={handleInvoiceSelect}
                  className="select-field"
                >
                  <option value="">-- Choose an unpaid or partial invoice --</option>
                  {invoices.map((inv) => {
                    const due = Math.max(0, (inv.grand_total || 0) - (inv.amount_paid || 0));
                    return (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} - {inv.customer_name} (Due: {formatCurrency(due)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Payment Mode
                </label>
                <select
                  value={formData.payment_mode}
                  onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
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
                  placeholder="e.g. UTR / Cheque / Txn ID"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
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
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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

      <DeleteModal
        isOpen={Boolean(deleteId)}
        title="Delete Payment"
        message="Are you sure you want to delete this payment record? The invoice outstanding balance will be recalculated."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
