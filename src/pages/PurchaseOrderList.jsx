import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, Trash2, ShoppingCart, Filter } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { PO_STATUSES } from '../utils/constants';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import EmptyState from '../components/EmptyState';
import DeleteModal from '../components/DeleteModal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const data = await api.get(`/purchase-orders?${params.toString()}`);
      setOrders(data || []);
    } catch (err) {
      toast.error('Failed to load purchase orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/purchase-orders/${deleteId}`);
      toast.success('Purchase order deleted successfully');
      setOrders(orders.filter((o) => o.id !== deleteId));
    } catch (err) {
      toast.error('Failed to delete purchase order: ' + err.message);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header mb-0">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your vendor purchase orders and incoming inventory
          </p>
        </div>
        <Link to="/purchase-orders/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Purchase Order
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by PO number or supplier name..."
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-field text-sm"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="confirmed">Confirmed</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8">
            <LoadingSpinner message="Loading purchase orders..." />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ShoppingCart}
              title="No Purchase Orders"
              description={search || statusFilter ? 'No orders match your filter criteria.' : 'Create your first purchase order to send to your suppliers.'}
              action={
                <Link to="/purchase-orders/new" className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Create Purchase Order
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-header">
                <tr>
                  <th className="p-4">PO Number</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">PO Date</th>
                  <th className="p-4">Expected Date</th>
                  <th className="p-4 text-right">Grand Total</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-mono font-semibold text-primary-600">
                      <Link to={`/purchase-orders/${po.id}`} className="hover:underline">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{po.supplier_name}</td>
                    <td className="p-4 text-gray-600">{formatDate(po.po_date)}</td>
                    <td className="p-4 text-gray-600">
                      {po.expected_date ? formatDate(po.expected_date) : '-'}
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-900">
                      {formatCurrency(po.grand_total)}
                    </td>
                    <td className="p-4 text-center">
                      <StatusBadge status={po.status} statusMap={PO_STATUSES} />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/purchase-orders/${po.id}`}
                          className="p-1.5 text-gray-500 hover:text-primary-600 rounded transition"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/purchase-orders/${po.id}/edit`}
                          className="p-1.5 text-gray-500 hover:text-blue-600 rounded transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteId(po.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 rounded transition"
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

      <DeleteModal
        isOpen={Boolean(deleteId)}
        title="Delete Purchase Order"
        message="Are you sure you want to delete this purchase order? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
