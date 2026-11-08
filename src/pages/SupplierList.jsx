import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Truck, AlertCircle, X } from 'lucide-react';
import { api } from '../utils/api';
import { STATE_CODES } from '../utils/helpers';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SupplierList() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await api.get(`/suppliers${params}`);
      setSuppliers(Array.isArray(data) ? data : data.suppliers || []);
    } catch (err) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  async function handleDelete() {
    if (!deleteModal) return;
    try {
      setDeleting(true);
      await api.delete(`/suppliers/${deleteModal.id}`);
      toast.success('Supplier deleted successfully');
      setDeleteModal(null);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete supplier');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="page-header mb-0">Suppliers</h1>
        <button onClick={() => navigate('/suppliers/new')} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, GSTIN, phone, or email..."
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner message="Loading suppliers..." />
      ) : suppliers.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Truck className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">
            {search ? 'No suppliers found' : 'No suppliers yet'}
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            {search
              ? 'Try adjusting your search query.'
              : 'Start by adding your first supplier.'}
          </p>
          {!search && (
            <button onClick={() => navigate('/suppliers/new')} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{supplier.gstin || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {supplier.state || STATE_CODES[supplier.state_code] || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{supplier.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{supplier.email || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal(supplier)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Supplier</h3>
              <button
                onClick={() => setDeleteModal(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-start gap-3 mb-6">
              <div className="bg-red-100 p-2 rounded-full mt-0.5">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteModal.name}</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
