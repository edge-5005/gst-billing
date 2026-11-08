import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  FileText,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  FileCheck,
  FileMinus,
  FilePlus,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { INVOICE_TYPES, INVOICE_STATUSES } from '../utils/constants';
import StatusBadge from '../components/StatusBadge';
import DeleteModal from '../components/DeleteModal';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import SearchBar from '../components/SearchBar';

const TYPE_COLORS = {
  tax_invoice: 'text-blue-700 bg-blue-50',
  bill_of_supply: 'text-purple-700 bg-purple-50',
  credit_note: 'text-orange-700 bg-orange-50',
  debit_note: 'text-teal-700 bg-teal-50',
};

const NEW_INVOICE_OPTIONS = [
  { type: 'tax_invoice', label: 'New Tax Invoice', path: '/invoices/new', icon: FileText },
  { type: 'bill_of_supply', label: 'New Bill of Supply', path: '/bill-of-supply/new', icon: FileCheck },
  { type: 'credit_note', label: 'New Credit Note', path: '/credit-notes/new', icon: FileMinus },
  { type: 'debit_note', label: 'New Debit Note', path: '/debit-notes/new', icon: FilePlus },
];

const PAGE_SIZE = 20;

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, number: '' });

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      params.set('page', page);
      params.set('limit', PAGE_SIZE);
      const queryString = params.toString();
      const data = await api.get(`/invoices${queryString ? `?${queryString}` : ''}`);
      setInvoices(data.invoices || data);
      setTotalCount(data.total ?? (data.invoices || data).length);
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownOpen && !e.target.closest('.dropdown-container')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted successfully');
      fetchInvoices();
    } catch (error) {
      toast.error(error.message || 'Failed to delete invoice');
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="page-header mb-0">Invoices</h1>
        <div className="relative dropdown-container">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Invoice
            <ChevronDown className="w-4 h-4" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
              {NEW_INVOICE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate(opt.path);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search invoices..."
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select-field"
          >
            <option value="">All Types</option>
            {Object.entries(INVOICE_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field"
          >
            <option value="">All Statuses</option>
            {Object.entries(INVOICE_STATUSES).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field"
              placeholder="From"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading invoices..." />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description="Create your first invoice to get started with billing."
            actionLabel="Create Invoice"
            onAction={() => navigate('/invoices/new')}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[invoice.type] || 'text-gray-700 bg-gray-50'}`}>
                          {INVOICE_TYPES[invoice.type] || invoice.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {invoice.customer_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(invoice.invoice_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">
                        {formatCurrency(invoice.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={invoice.status} statusMap={INVOICE_STATUSES} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/invoices/${invoice.id}`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/invoices/${invoice.id}/edit`}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setDeleteModal({ open: true, id: invoice.id, number: invoice.invoice_number })}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} invoices
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item)}
                          className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                            page === item
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null, number: '' })}
        onConfirm={() => handleDelete(deleteModal.id)}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice "${deleteModal.number}"? This action cannot be undone.`}
      />
    </div>
  );
}
