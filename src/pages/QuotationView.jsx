import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Printer,
  Edit,
  Trash2,
  FileCheck,
  Building2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import {
  formatCurrency,
  formatDate,
  numberToWords
} from '../utils/helpers';
import { QUOTATION_STATUSES } from '../utils/constants';
import StatusBadge from '../components/StatusBadge';
import DeleteModal from '../components/DeleteModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { generateQuotationPdf } from '../pdf/quotationPdf';

export default function QuotationView() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState(null);
  const [company, setCompany] = useState({});
  const [converting, setConverting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [qData, compData] = await Promise.all([
        api.get(`/quotations/${id}`),
        api.get('/company').catch(() => ({})),
      ]);
      setQuotation(qData);
      setCompany(compData || {});
    } catch (err) {
      toast.error('Failed to load quotation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = async () => {
    try {
      await api.delete(`/quotations/${id}`);
      toast.success('Quotation deleted successfully');
      navigate('/quotations');
    } catch (err) {
      toast.error('Failed to delete quotation: ' + err.message);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!quotation) return;
    try {
      generateQuotationPdf(quotation, company);
      toast.success('Generating PDF...');
    } catch (err) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
  };

  const handleConvert = async () => {
    try {
      setConverting(true);
      const res = await api.post(`/quotations/${id}/convert`);
      toast.success('Quotation converted to Tax Invoice successfully!');
      if (res && res.invoice_id) {
        navigate(`/invoices/${res.invoice_id}`);
      } else {
        navigate('/invoices');
      }
    } catch (err) {
      toast.error('Failed to convert quotation: ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading quotation details..." />;
  if (!quotation) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Quotation Not Found</h2>
        <Link to="/quotations" className="btn-primary mt-4 inline-flex">
          Back to Quotations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/quotations')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">
                {quotation.quotation_number}
              </h1>
              <StatusBadge status={quotation.status} statusMap={QUOTATION_STATUSES} />
            </div>
            <p className="text-sm text-gray-500">
              Quotation / Estimate • Created on {formatDate(quotation.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quotation.status !== 'converted' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="btn-success text-sm"
            >
              <FileCheck className="w-4 h-4" />
              {converting ? 'Converting...' : 'Convert to Invoice'}
            </button>
          )}

          <button onClick={handleDownloadPdf} className="btn-primary text-sm">
            <Download className="w-4 h-4" />
            PDF
          </button>

          <button onClick={() => window.print()} className="btn-secondary text-sm">
            <Printer className="w-4 h-4" />
            Print
          </button>

          <Link to={`/quotations/${id}/edit`} className="btn-secondary text-sm">
            <Edit className="w-4 h-4" />
            Edit
          </Link>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete Quotation"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Document Card */}
      <div className="card p-8 bg-white border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0">
        <div className="flex flex-col md:flex-row justify-between pb-6 border-b border-gray-200 gap-6">
          <div className="flex items-start gap-4">
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt={company.name || 'Company Logo'}
                className="max-h-20 max-w-[140px] object-contain rounded border border-gray-200 p-1.5 bg-white shrink-0 shadow-sm"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-primary-900 mb-1">
                {company.name || 'Your Company Name'}
              </h2>
              <div className="text-sm text-gray-600 space-y-0.5">
                {company.address && <p>{company.address}</p>}
                <p>
                  {[company.city, company.state, company.pincode].filter(Boolean).join(', ')}
                </p>
                {company.gstin && <p><strong>GSTIN:</strong> {company.gstin}</p>}
                {company.phone && <p><strong>Phone:</strong> {company.phone}</p>}
                {company.email && <p><strong>Email:</strong> {company.email}</p>}
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col justify-between">
            <div>
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold uppercase rounded tracking-wider mb-2">
                QUOTATION / ESTIMATE
              </span>
              <p className="text-lg font-bold text-gray-900 font-mono">
                {quotation.quotation_number}
              </p>
            </div>

            <div className="text-sm text-gray-600 space-y-0.5 mt-3">
              <p><strong>Date:</strong> {formatDate(quotation.quotation_date)}</p>
              {quotation.valid_until && (
                <p><strong>Valid Until:</strong> {formatDate(quotation.valid_until)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="py-6 border-b border-gray-200">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Quotation For:
          </h3>
          <p className="text-base font-bold text-gray-900">{quotation.customer_name}</p>
          <div className="text-sm text-gray-600 space-y-0.5 mt-1">
            {quotation.billing_address && <p>{quotation.billing_address}</p>}
            <p>
              {[quotation.billing_city, quotation.billing_state, quotation.billing_pincode]
                .filter(Boolean)
                .join(', ')}
            </p>
            {quotation.customer_gstin && <p><strong>GSTIN:</strong> {quotation.customer_gstin}</p>}
            {quotation.customer_phone && <p><strong>Phone:</strong> {quotation.customer_phone}</p>}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-gray-700 bg-gray-50">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 w-24">HSN/SAC</th>
                <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                <th className="py-2.5 px-3 w-24 text-right">Rate</th>
                <th className="py-2.5 px-3 w-28 text-right">Taxable</th>
                <th className="py-2.5 px-3 w-20 text-right">GST %</th>
                <th className="py-2.5 px-3 w-24 text-right">Tax</th>
                <th className="py-2.5 px-3 w-32 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(quotation.items || []).map((item, idx) => {
                const tax = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
                return (
                  <tr key={item.id || idx}>
                    <td className="py-3 px-3 text-center text-gray-400 text-xs">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-gray-900">{item.description}</p>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-gray-600">{item.hsn_sac || '-'}</td>
                    <td className="py-3 px-3 text-right">
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td className="py-3 px-3 text-right">{formatCurrency(item.rate)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(item.taxable_amount)}</td>
                    <td className="py-3 px-3 text-right">{item.gst_rate}%</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(tax)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
          <div>
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 mb-4">
              <span className="font-semibold text-gray-700 block mb-0.5">Total Amount in Words:</span>
              <p className="font-medium text-gray-900">{numberToWords(quotation.grand_total)}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-medium text-gray-900">{formatCurrency(quotation.subtotal)}</span>
            </div>

            {quotation.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(quotation.discount_amount)}</span>
              </div>
            )}

            {quotation.igst_total > 0 ? (
              <div className="flex justify-between text-gray-600">
                <span>IGST:</span>
                <span className="font-medium text-gray-900">{formatCurrency(quotation.igst_total)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(quotation.cgst_total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(quotation.sgst_total)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
              <span>Grand Total:</span>
              <span className="text-primary-700">{formatCurrency(quotation.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-500">
          <div>
            {quotation.terms && (
              <div className="mb-3">
                <span className="font-semibold text-gray-700 block mb-1">Terms & Conditions:</span>
                <p className="whitespace-pre-line text-gray-600">{quotation.terms}</p>
              </div>
            )}
            {quotation.notes && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Notes:</span>
                <p className="whitespace-pre-line text-gray-600">{quotation.notes}</p>
              </div>
            )}
          </div>

          <div className="text-right flex flex-col justify-end">
            <p className="text-gray-700 font-semibold mb-12">
              For {company.name || 'Authorized Signatory'}
            </p>
            <p className="text-gray-400">Authorized Signature</p>
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Quotation"
        message={`Are you sure you want to delete quotation ${quotation.quotation_number}?`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
