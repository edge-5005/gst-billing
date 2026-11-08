import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { QUOTATION_STATUSES } from '../utils/constants';
import StatusBadge from '../components/StatusBadge';
import DeleteModal from '../components/DeleteModal';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import SearchBar from '../components/SearchBar';

export default function QuotationList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, number: '' });

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/quotations');
      setQuotations(data);
    } catch (err) {
      toast.error('Failed to load quotations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/quotations/${id}`);
      toast.success('Quotation deleted successfully');
      fetchQuotations();
    } catch (err) {
      toast.error('Failed to delete quotation: ' + err.message);
    }
  };

  const filtered = quotations.filter((q) => {
    const matchesSearch =
      !search ||
      (q.quotation_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.customer_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="page-header mb-0">Quotations</h1>
        <Link to="/quotations/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Quotation
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search quotations..."
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field sm:w-48"
          >
            <option value="">All Statuses</option>
            {Object.entries(QUOTATION_STATUSES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading quotations..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotations found"
            description={
              search || statusFilter
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first quotation to get started.'
            }
            actionLabel={!search && !statusFilter ? 'New Quotation' : undefined}
            onAction={!search && !statusFilter ? () => navigate('/quotations/new') : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3">Quotation #</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Valid Until</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        to={`/quotations/${q.id}`}
                        className="font-medium text-primary-600 hover:text-primary-800"
                      >
                        {q.quotation_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {q.customer_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(q.quotation_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(q.valid_until)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(q.total_payable || q.grand_total)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={q.status} statusMap={QUOTATION_STATUSES} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/quotations/${q.id}`}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/quotations/${q.id}/edit`}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() =>
                            setDeleteModal({ open: true, id: q.id, number: q.quotation_number })
                          }
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        )}
      </div>

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null, number: '' })}
        onConfirm={() => handleDelete(deleteModal.id)}
        title="Delete Quotation"
        message={`Are you sure you want to delete quotation "${deleteModal.number}"? This action cannot be undone.`}
      />
    </div>
  );
}
