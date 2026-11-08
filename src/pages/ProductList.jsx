import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Package, AlertCircle, X, Filter } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency, GST_RATES } from '../utils/helpers';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';

const GST_BADGE_COLORS = {
  0: 'bg-gray-100 text-gray-700',
  5: 'bg-blue-100 text-blue-700',
  12: 'bg-green-100 text-green-700',
  18: 'bg-yellow-100 text-yellow-700',
  28: 'bg-red-100 text-red-700',
};

function getGstBadgeColor(rate) {
  return GST_BADGE_COLORS[rate] || 'bg-purple-100 text-purple-700';
}

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const queryString = params.toString();
      const data = await api.get(`/products${queryString ? '?' + queryString : ''}`);
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  async function handleDelete() {
    if (!deleteModal) return;
    try {
      setDeleting(true);
      await api.delete(`/products/${deleteModal.id}`);
      toast.success('Product deleted successfully');
      setDeleteModal(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="page-header mb-0">Products</h1>
        <button onClick={() => navigate('/products/new')} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search & Filter */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or HSN/SAC..."
              className="input-field pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="select-field w-auto"
            >
              <option value="all">All Types</option>
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner message="Loading products..." />
      ) : products.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Package className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">
            {search || typeFilter !== 'all' ? 'No products found' : 'No products yet'}
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            {search || typeFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Start by adding your first product.'}
          </p>
          {!search && typeFilter === 'all' && (
            <button onClick={() => navigate('/products/new')} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Product
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
                  <th className="px-4 py-3">HSN/SAC</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Sale Price</th>
                  <th className="px-4 py-3 text-center">GST Rate</th>
                  <th className="px-4 py-3 text-right">Stock Qty</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const stockQty = Number(product.stock_qty) || 0;
                  const isLowStock = stockQty < 10 && product.type !== 'services';
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{product.hsn_sac || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.type === 'goods'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}>
                          {product.type === 'goods' ? 'Goods' : 'Services'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{product.unit || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">
                        {formatCurrency(product.sale_price)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getGstBadgeColor(product.gst_rate)}`}>
                          {product.gst_rate}%
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${
                        isLowStock ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {product.type === 'services' ? '—' : (
                          <span className="inline-flex items-center gap-1">
                            {stockQty}
                            {isLowStock && (
                              <span className="text-xs text-red-500 font-normal">(Low)</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/products/${product.id}/edit`)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModal(product)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              <h3 className="text-lg font-semibold text-gray-900">Delete Product</h3>
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
