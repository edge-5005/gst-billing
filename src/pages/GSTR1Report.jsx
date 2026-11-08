import React, { useState, useEffect } from 'react';
import { Download, Printer, Filter, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getToday } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function GSTR1Report() {
  // Default to current month range
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = getToday();

  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(lastDay);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('rate'); // 'rate' | 'b2b' | 'b2c' | 'cdn'

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reports/gstr1?from_date=${fromDate}&to_date=${toDate}`);
      setData(res);
    } catch (err) {
      toast.error('Failed to generate GSTR-1 report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const exportCSV = () => {
    if (!data) return;
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'rate') {
      csvContent += 'GST Rate,Invoice Count,Taxable Value,CGST,SGST,IGST,Total Value\n';
      (data.rate_summary || []).forEach((r) => {
        csvContent += `"${r.gst_rate}%",${r.invoice_count},${r.taxable_value},${r.cgst},${r.sgst},${r.igst},${r.total}\n`;
      });
    } else if (activeTab === 'b2b') {
      csvContent += 'GSTIN,Customer Name,Invoice No,Date,Type,Place of Supply,Taxable,CGST,SGST,IGST,Total\n';
      (data.b2b || []).forEach((b) => {
        csvContent += `"${b.customer_gstin}","${b.customer_name}","${b.invoice_number}","${b.invoice_date}","${b.invoice_type}","${b.place_of_supply}",${b.subtotal},${b.cgst_total},${b.sgst_total},${b.igst_total},${b.grand_total}\n`;
      });
    } else if (activeTab === 'b2c') {
      csvContent += 'Customer Name,Invoice No,Date,Place of Supply,Taxable,CGST,SGST,IGST,Total\n';
      (data.b2c || []).forEach((b) => {
        csvContent += `"${b.customer_name}","${b.invoice_number}","${b.invoice_date}","${b.place_of_supply}",${b.subtotal},${b.cgst_total},${b.sgst_total},${b.igst_total},${b.grand_total}\n`;
      });
    } else if (activeTab === 'cdn') {
      csvContent += 'Type,Count,Taxable Value,CGST,SGST,IGST,Total\n';
      (data.cdn_summary || []).forEach((c) => {
        csvContent += `"${c.invoice_type}",${c.count},${c.taxable_value},${c.cgst},${c.sgst},${c.igst},${c.total}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GSTR1_${activeTab}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV downloaded successfully');
  };

  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="page-header mb-0">GSTR-1 Summary Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Details of outward supplies of goods or services for tax return filing
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
            Generate Report
          </button>
        </form>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Taxable Value</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(totals.total_taxable || 0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">CGST Amount</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(totals.total_cgst || 0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">SGST Amount</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(totals.total_sgst || 0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">IGST Amount</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(totals.total_igst || 0)}
          </p>
        </div>
        <div className="card p-4 bg-primary-50 border-primary-200">
          <p className="text-xs font-medium text-primary-700 uppercase">Total Tax Value</p>
          <p className="text-xl font-bold text-primary-900 mt-1">
            {formatCurrency(totals.total_tax || 0)}
          </p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="border-b border-gray-200 no-print">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('rate')}
            className={`py-3 px-1 border-b-2 transition ${
              activeTab === 'rate'
                ? 'border-primary-600 text-primary-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Rate-wise Summary
          </button>
          <button
            onClick={() => setActiveTab('b2b')}
            className={`py-3 px-1 border-b-2 transition ${
              activeTab === 'b2b'
                ? 'border-primary-600 text-primary-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            B2B Invoices (Table 4)
          </button>
          <button
            onClick={() => setActiveTab('b2c')}
            className={`py-3 px-1 border-b-2 transition ${
              activeTab === 'b2c'
                ? 'border-primary-600 text-primary-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            B2C Invoices (Table 5/7)
          </button>
          <button
            onClick={() => setActiveTab('cdn')}
            className={`py-3 px-1 border-b-2 transition ${
              activeTab === 'cdn'
                ? 'border-primary-600 text-primary-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Credit / Debit Notes (Table 9B)
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-12">
            <LoadingSpinner message="Calculating GSTR-1 summary..." />
          </div>
        ) : !data ? (
          <div className="p-8 text-center text-gray-500">
            Click Generate Report to view data.
          </div>
        ) : (
          <div>
            {activeTab === 'rate' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="p-4">Tax Rate</th>
                      <th className="p-4 text-center">Invoices</th>
                      <th className="p-4 text-right">Taxable Value</th>
                      <th className="p-4 text-right">CGST</th>
                      <th className="p-4 text-right">SGST</th>
                      <th className="p-4 text-right">IGST</th>
                      <th className="p-4 text-right">Total Invoice Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data.rate_summary || []).length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-gray-500">
                          No outward tax data found in this date range.
                        </td>
                      </tr>
                    ) : (
                      data.rate_summary.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-4 font-semibold text-gray-800">{r.gst_rate}%</td>
                          <td className="p-4 text-center text-gray-600">{r.invoice_count}</td>
                          <td className="p-4 text-right font-medium text-gray-900">
                            {formatCurrency(r.taxable_value)}
                          </td>
                          <td className="p-4 text-right text-gray-700">{formatCurrency(r.cgst)}</td>
                          <td className="p-4 text-right text-gray-700">{formatCurrency(r.sgst)}</td>
                          <td className="p-4 text-right text-gray-700">{formatCurrency(r.igst)}</td>
                          <td className="p-4 text-right font-bold text-primary-700">
                            {formatCurrency(r.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'b2b' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="p-4">Customer GSTIN</th>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Place of Supply</th>
                      <th className="p-4 text-right">Taxable Value</th>
                      <th className="p-4 text-right">Total Tax</th>
                      <th className="p-4 text-right">Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data.b2b || []).length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-6 text-center text-gray-500">
                          No B2B invoices found in this period.
                        </td>
                      </tr>
                    ) : (
                      data.b2b.map((b, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-4 font-mono text-xs font-semibold text-gray-900">
                            {b.customer_gstin}
                          </td>
                          <td className="p-4 font-medium text-gray-800">{b.customer_name}</td>
                          <td className="p-4 font-mono text-primary-600">{b.invoice_number}</td>
                          <td className="p-4 text-gray-600">{formatDate(b.invoice_date)}</td>
                          <td className="p-4 text-gray-600">{b.place_of_supply}</td>
                          <td className="p-4 text-right">{formatCurrency(b.subtotal)}</td>
                          <td className="p-4 text-right font-medium text-gray-700">
                            {formatCurrency(b.total_tax)}
                          </td>
                          <td className="p-4 text-right font-bold text-gray-900">
                            {formatCurrency(b.grand_total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'b2c' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Place of Supply</th>
                      <th className="p-4 text-right">Taxable Value</th>
                      <th className="p-4 text-right">Total Tax</th>
                      <th className="p-4 text-right">Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data.b2c || []).length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-gray-500">
                          No B2C transactions found in this period.
                        </td>
                      </tr>
                    ) : (
                      data.b2c.map((b, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-4 font-medium text-gray-800">{b.customer_name}</td>
                          <td className="p-4 font-mono text-primary-600">{b.invoice_number}</td>
                          <td className="p-4 text-gray-600">{formatDate(b.invoice_date)}</td>
                          <td className="p-4 text-gray-600">{b.place_of_supply || '-'}</td>
                          <td className="p-4 text-right">{formatCurrency(b.subtotal)}</td>
                          <td className="p-4 text-right font-medium text-gray-700">
                            {formatCurrency(b.total_tax)}
                          </td>
                          <td className="p-4 text-right font-bold text-gray-900">
                            {formatCurrency(b.grand_total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'cdn' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="p-4">Note Type</th>
                      <th className="p-4 text-center">Count</th>
                      <th className="p-4 text-right">Taxable Value</th>
                      <th className="p-4 text-right">CGST</th>
                      <th className="p-4 text-right">SGST</th>
                      <th className="p-4 text-right">IGST</th>
                      <th className="p-4 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data.cdn_summary || []).length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-gray-500">
                          No credit or debit notes found in this period.
                        </td>
                      </tr>
                    ) : (
                      data.cdn_summary.map((c, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-4 font-semibold capitalize text-gray-900">
                            {c.invoice_type?.replace('_', ' ')}
                          </td>
                          <td className="p-4 text-center text-gray-600">{c.count}</td>
                          <td className="p-4 text-right font-medium">{formatCurrency(c.taxable_value)}</td>
                          <td className="p-4 text-right text-gray-700">{formatCurrency(c.cgst)}</td>
                          <td className="p-4 text-right text-gray-700">{formatCurrency(c.sgst)}</td>
                          <td className="p-4 text-right text-gray-700">{formatCurrency(c.igst)}</td>
                          <td className="p-4 text-right font-bold text-primary-700">
                            {formatCurrency(c.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
