import React, { useState, useEffect } from 'react';
import { Download, Printer, Filter, ClipboardList } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { formatCurrency, getToday } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function HSNReport() {
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = getToday();

  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(lastDay);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reports/hsn-summary?from_date=${fromDate}&to_date=${toDate}`);
      setData(res);
    } catch (err) {
      toast.error('Failed to load HSN summary: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const exportCSV = () => {
    if (!data || !data.items || data.items.length === 0) return;
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'HSN/SAC,Unit,GST Rate,Total Quantity,Taxable Value,CGST,SGST,IGST,Total Tax,Total Value\n';

    data.items.forEach((it) => {
      csv += `"${it.hsn_sac}","${it.unit}","${it.gst_rate}%",${it.total_quantity},${it.taxable_value},${it.cgst},${it.sgst},${it.igst},${it.total_tax},${it.total_value}\n`;
    });

    const totals = data.totals || {};
    csv += `"TOTAL","",,"${totals.total_quantity || 0}",${totals.taxable_value || 0},${totals.cgst || 0},${totals.sgst || 0},${totals.igst || 0},${totals.total_tax || 0},${totals.total_value || 0}\n`;

    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSN_Summary_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV downloaded successfully');
  };

  const items = data?.items || [];
  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="page-header mb-0">HSN/SAC Wise Summary Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Table 12 summary of outward supplies categorized by Harmonized System of Nomenclature (HSN) codes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={() => window.print()} className="btn-secondary text-sm">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="card p-4 no-print">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchReport();
          }}
          className="flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              required
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              required
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field text-sm"
            />
          </div>

          <button type="submit" className="btn-primary text-sm py-2">
            <Filter className="w-4 h-4" />
            Generate Summary
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-12">
            <LoadingSpinner message="Calculating HSN-wise sales data..." />
          </div>
        ) : !data || items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No HSN Data Available</p>
            <p className="text-sm text-gray-400 mt-1">
              Ensure invoices in this period include items with HSN/SAC codes entered.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-header">
                <tr>
                  <th className="p-4">HSN / SAC</th>
                  <th className="p-4 text-center">Unit</th>
                  <th className="p-4 text-center">Rate</th>
                  <th className="p-4 text-right">Total Qty</th>
                  <th className="p-4 text-right">Taxable Value</th>
                  <th className="p-4 text-right">CGST</th>
                  <th className="p-4 text-right">SGST</th>
                  <th className="p-4 text-right">IGST</th>
                  <th className="p-4 text-right">Total Tax</th>
                  <th className="p-4 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-4 font-mono font-bold text-gray-900">{it.hsn_sac}</td>
                    <td className="p-4 text-center text-gray-600">{it.unit}</td>
                    <td className="p-4 text-center text-gray-700 font-medium">{it.gst_rate}%</td>
                    <td className="p-4 text-right font-medium text-gray-800">{it.total_quantity}</td>
                    <td className="p-4 text-right font-medium text-gray-900">{formatCurrency(it.taxable_value)}</td>
                    <td className="p-4 text-right text-gray-600">{formatCurrency(it.cgst)}</td>
                    <td className="p-4 text-right text-gray-600">{formatCurrency(it.sgst)}</td>
                    <td className="p-4 text-right text-gray-600">{formatCurrency(it.igst)}</td>
                    <td className="p-4 text-right font-medium text-gray-800">{formatCurrency(it.total_tax)}</td>
                    <td className="p-4 text-right font-bold text-primary-700">{formatCurrency(it.total_value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
                <tr>
                  <td colSpan="3" className="p-4 text-gray-900 uppercase">
                    Total
                  </td>
                  <td className="p-4 text-right text-gray-900">{totals.total_quantity || 0}</td>
                  <td className="p-4 text-right text-gray-900">{formatCurrency(totals.taxable_value || 0)}</td>
                  <td className="p-4 text-right text-gray-900">{formatCurrency(totals.cgst || 0)}</td>
                  <td className="p-4 text-right text-gray-900">{formatCurrency(totals.sgst || 0)}</td>
                  <td className="p-4 text-right text-gray-900">{formatCurrency(totals.igst || 0)}</td>
                  <td className="p-4 text-right text-gray-900">{formatCurrency(totals.total_tax || 0)}</td>
                  <td className="p-4 text-right text-primary-700 font-extrabold">
                    {formatCurrency(totals.total_value || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
