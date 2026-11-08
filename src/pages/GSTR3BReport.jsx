import React, { useState, useEffect } from 'react';
import { Download, Printer, Filter, ShieldCheck, DollarSign } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { formatCurrency, getToday } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function GSTR3BReport() {
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
      const res = await api.get(`/reports/gstr3b?from_date=${fromDate}&to_date=${toDate}`);
      setData(res);
    } catch (err) {
      toast.error('Failed to generate GSTR-3B report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const exportCSV = () => {
    if (!data) return;
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Section,Description,Taxable Value,IGST,CGST,SGST,Total Tax\n';

    const out = data.outward_taxable || {};
    csv += `"3.1(a)","Outward Taxable Supplies",${out.taxable_value || 0},${out.igst || 0},${out.cgst || 0},${out.sgst || 0},${out.total_tax || 0}\n`;

    const ex = data.outward_exempt || {};
    csv += `"3.1(c)","Exempt/Nil Rated Supplies",${ex.total_value || 0},0,0,0,0\n`;

    const itc = data.itc_available || {};
    csv += `"4(A)","Eligible ITC (Purchases)",0,${itc.igst || 0},${itc.cgst || 0},${itc.sgst || 0},${itc.total_tax || 0}\n`;

    const net = data.net_liability || {};
    csv += `"6.1","Net Tax Payable",0,${net.igst || 0},${net.cgst || 0},${net.sgst || 0},${net.total || 0}\n`;

    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GSTR3B_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV downloaded successfully');
  };

  const outward = data?.outward_taxable || {};
  const exempt = data?.outward_exempt || {};
  const itc = data?.itc_available || {};
  const net = data?.net_liability || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="page-header mb-0">GSTR-3B Monthly Return Summary</h1>
          <p className="text-sm text-gray-500 mt-1">
            Summary of outward supplies, input tax credit (ITC) and net tax payment liability
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={() => window.print()} className="btn-secondary text-sm">
            <Printer className="w-4 h-4" />
            Print Form
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
            Generate Return
          </button>
        </form>
      </div>

      {loading ? (
        <div className="card p-12">
          <LoadingSpinner message="Calculating GSTR-3B figures..." />
        </div>
      ) : !data ? (
        <div className="card p-8 text-center text-gray-500">
          Click Generate Return to display data.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Net Tax Liability Alert Box */}
          <div className="card bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-indigo-200 font-semibold block">
                  Net Tax Liability Payable
                </span>
                <h2 className="text-3xl font-extrabold mt-1">
                  {formatCurrency(Math.max(0, net.total || 0))}
                </h2>
                <p className="text-xs text-indigo-200 mt-1">
                  Tax on outward supplies minus eligible Input Tax Credit (ITC)
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-sm bg-white/10 p-4 rounded-xl border border-white/10">
                <div>
                  <span className="text-indigo-200 block text-xs">IGST Payable</span>
                  <span className="font-bold text-base">{formatCurrency(Math.max(0, net.igst || 0))}</span>
                </div>
                <div className="border-l border-white/20 pl-4">
                  <span className="text-indigo-200 block text-xs">CGST Payable</span>
                  <span className="font-bold text-base">{formatCurrency(Math.max(0, net.cgst || 0))}</span>
                </div>
                <div className="border-l border-white/20 pl-4">
                  <span className="text-indigo-200 block text-xs">SGST Payable</span>
                  <span className="font-bold text-base">{formatCurrency(Math.max(0, net.sgst || 0))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table 3.1: Outward Supplies */}
          <div className="card overflow-hidden p-0 border border-gray-200">
            <div className="bg-gray-100 p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm">
                3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                  <tr>
                    <th className="p-3">Nature of Supplies</th>
                    <th className="p-3 text-right">Total Taxable Value</th>
                    <th className="p-3 text-right">Integrated Tax (IGST)</th>
                    <th className="p-3 text-right">Central Tax (CGST)</th>
                    <th className="p-3 text-right">State/UT Tax (SGST)</th>
                    <th className="p-3 text-right">Cess</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3 font-medium text-gray-800">
                      (a) Outward taxable supplies (other than zero rated, nil rated & exempted)
                    </td>
                    <td className="p-3 text-right font-medium">{formatCurrency(outward.taxable_value || 0)}</td>
                    <td className="p-3 text-right">{formatCurrency(outward.igst || 0)}</td>
                    <td className="p-3 text-right">{formatCurrency(outward.cgst || 0)}</td>
                    <td className="p-3 text-right">{formatCurrency(outward.sgst || 0)}</td>
                    <td className="p-3 text-right">₹0.00</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-600">(b) Outward taxable supplies (zero rated)</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-600">(c) Other outward supplies (Nil rated, exempted)</td>
                    <td className="p-3 text-right">{formatCurrency(exempt.total_value || 0)}</td>
                    <td className="p-3 text-right text-gray-400">-</td>
                    <td className="p-3 text-right text-gray-400">-</td>
                    <td className="p-3 text-right text-gray-400">-</td>
                    <td className="p-3 text-right text-gray-400">-</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-600">(d) Inward supplies liable to reverse charge</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4: Eligible ITC */}
          <div className="card overflow-hidden p-0 border border-gray-200">
            <div className="bg-gray-100 p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm">
                4. Eligible Input Tax Credit (ITC)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                  <tr>
                    <th className="p-3">Details</th>
                    <th className="p-3 text-right">Integrated Tax (IGST)</th>
                    <th className="p-3 text-right">Central Tax (CGST)</th>
                    <th className="p-3 text-right">State/UT Tax (SGST)</th>
                    <th className="p-3 text-right">Cess</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3 font-medium text-gray-800">
                      (A) ITC Available (whether in full or part) — Purchase Orders Received
                    </td>
                    <td className="p-3 text-right font-medium text-green-700">{formatCurrency(itc.igst || 0)}</td>
                    <td className="p-3 text-right font-medium text-green-700">{formatCurrency(itc.cgst || 0)}</td>
                    <td className="p-3 text-right font-medium text-green-700">{formatCurrency(itc.sgst || 0)}</td>
                    <td className="p-3 text-right">₹0.00</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-gray-600">(B) ITC Reversed</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                    <td className="p-3 text-right">₹0.00</td>
                  </tr>
                  <tr className="bg-green-50/50 font-semibold">
                    <td className="p-3 text-gray-900">(C) Net ITC Available (A) - (B)</td>
                    <td className="p-3 text-right text-green-800">{formatCurrency(itc.igst || 0)}</td>
                    <td className="p-3 text-right text-green-800">{formatCurrency(itc.cgst || 0)}</td>
                    <td className="p-3 text-right text-green-800">{formatCurrency(itc.sgst || 0)}</td>
                    <td className="p-3 text-right">₹0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 6.1: Payment of Tax */}
          <div className="card overflow-hidden p-0 border border-gray-200">
            <div className="bg-gray-100 p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm">
                6.1 Payment of Tax (Net Tax Payable after ITC Adjustment)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Tax Payable</th>
                    <th className="p-3 text-right">Paid Through ITC</th>
                    <th className="p-3 text-right">Tax Paid in Cash / Net Liability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3 font-semibold text-gray-800">Integrated Tax (IGST)</td>
                    <td className="p-3 text-right">{formatCurrency(outward.igst || 0)}</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(itc.igst || 0)}</td>
                    <td className="p-3 text-right font-bold text-gray-900">
                      {formatCurrency(Math.max(0, (outward.igst || 0) - (itc.igst || 0)))}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-gray-800">Central Tax (CGST)</td>
                    <td className="p-3 text-right">{formatCurrency(outward.cgst || 0)}</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(itc.cgst || 0)}</td>
                    <td className="p-3 text-right font-bold text-gray-900">
                      {formatCurrency(Math.max(0, (outward.cgst || 0) - (itc.cgst || 0)))}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-gray-800">State/UT Tax (SGST)</td>
                    <td className="p-3 text-right">{formatCurrency(outward.sgst || 0)}</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(itc.sgst || 0)}</td>
                    <td className="p-3 text-right font-bold text-gray-900">
                      {formatCurrency(Math.max(0, (outward.sgst || 0) - (itc.sgst || 0)))}
                    </td>
                  </tr>
                  <tr className="bg-primary-50/50 font-bold">
                    <td className="p-3 text-primary-900">Total Tax Liability</td>
                    <td className="p-3 text-right text-primary-900">{formatCurrency(outward.total_tax || 0)}</td>
                    <td className="p-3 text-right text-green-700">{formatCurrency(itc.total_tax || 0)}</td>
                    <td className="p-3 text-right text-primary-700 font-extrabold">
                      {formatCurrency(Math.max(0, net.total || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
