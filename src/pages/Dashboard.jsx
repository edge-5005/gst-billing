import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  IndianRupee, Users, FileText, AlertCircle, Eye, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { INVOICE_STATUSES } from '../utils/constants';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48'];

const BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

function CurrencyTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-2">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-sm text-blue-600 font-semibold">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const result = await api.get('/reports/dashboard');
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-red-600 font-medium">Failed to load dashboard</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      title: 'Total Sales',
      value: formatCurrency(data.totalSales || 0),
      icon: IndianRupee,
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-500',
      textColor: 'text-blue-700',
    },
    {
      title: 'Outstanding Receivables',
      value: formatCurrency(data.outstandingReceivables || 0),
      icon: TrendingUp,
      bg: 'bg-orange-50',
      iconBg: 'bg-orange-500',
      textColor: 'text-orange-700',
    },
    {
      title: 'Total Invoices',
      value: data.totalInvoices || 0,
      icon: FileText,
      bg: 'bg-green-50',
      iconBg: 'bg-green-500',
      textColor: 'text-green-700',
    },
    {
      title: 'Total Customers',
      value: data.totalCustomers || 0,
      icon: Users,
      bg: 'bg-purple-50',
      iconBg: 'bg-purple-500',
      textColor: 'text-purple-700',
    },
  ];

  const monthlySales = data.monthlySales || [];
  const topCustomers = data.topCustomers || [];
  const gstLiability = data.gstLiability || { cgst: 0, sgst: 0, igst: 0 };
  const recentInvoices = data.recentInvoices || [];

  return (
    <div className="space-y-6">
      <h1 className="page-header">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className={`card ${stat.bg} border-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.textColor}`}>{stat.value}</p>
                </div>
                <div className={`${stat.iconBg} p-3 rounded-xl`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Sales Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Monthly Sales (Last 12 Months)</h2>
        {monthlySales.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlySales} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {monthlySales.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">No sales data available yet.</p>
        )}
      </div>

      {/* Top Customers + GST Liability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Customers */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Customers</h2>
          {topCustomers.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {topCustomers.map((_, index) => (
                    <Cell key={`cust-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">No customer data available yet.</p>
          )}
        </div>

        {/* GST Liability */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">GST Liability Summary</h2>
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
              <div>
                <p className="text-sm text-gray-500">CGST</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(gstLiability.cgst)}</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-lg">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
              <div>
                <p className="text-sm text-gray-500">SGST</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(gstLiability.sgst)}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-lg">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
              <div>
                <p className="text-sm text-gray-500">IGST</p>
                <p className="text-xl font-bold text-purple-700">{formatCurrency(gstLiability.igst)}</p>
              </div>
              <div className="bg-purple-500 p-3 rounded-lg">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Total GST Liability</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency((gstLiability.cgst || 0) + (gstLiability.sgst || 0) + (gstLiability.igst || 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Recent Invoices</h2>
          <Link to="/invoices" className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        {recentInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">
                      {formatCurrency(inv.total_payable)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={inv.status} statusMap={INVOICE_STATUSES} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No invoices yet. Create your first invoice to get started.</p>
        )}
      </div>
    </div>
  );
}
