import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/reports/dashboard — totals, monthly sales, top customers, recent invoices, GST liability
router.get('/dashboard', (req, res) => {
  try {
    // Total sales (tax_invoice + bill_of_supply, not cancelled)
    const totalSales = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as total
      FROM invoices
      WHERE invoice_type IN ('tax_invoice', 'bill_of_supply') AND status != 'cancelled'
    `).get();

    // Total receivables (unpaid + partial)
    const totalReceivables = db.prepare(`
      SELECT COALESCE(SUM(grand_total - amount_paid), 0) as total
      FROM invoices
      WHERE invoice_type IN ('tax_invoice', 'bill_of_supply')
        AND status IN ('unpaid', 'partial')
    `).get();

    // Invoice count
    const invoicesCount = db.prepare(`
      SELECT COUNT(*) as count FROM invoices
      WHERE invoice_type IN ('tax_invoice', 'bill_of_supply') AND status != 'cancelled'
    `).get();

    // Customer count
    const customersCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();

    // Monthly sales — last 12 months
    const monthlySales = db.prepare(`
      SELECT
        strftime('%Y-%m', invoice_date) as month,
        COALESCE(SUM(grand_total), 0) as total,
        COUNT(*) as count
      FROM invoices
      WHERE invoice_type IN ('tax_invoice', 'bill_of_supply')
        AND status != 'cancelled'
        AND invoice_date >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', invoice_date)
      ORDER BY month ASC
    `).all();

    // Top 5 customers by revenue
    const topCustomers = db.prepare(`
      SELECT c.id, c.name,
             COALESCE(SUM(i.grand_total), 0) as total_revenue,
             COUNT(i.id) as invoice_count
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id
        AND i.invoice_type IN ('tax_invoice', 'bill_of_supply')
        AND i.status != 'cancelled'
      GROUP BY c.id
      HAVING total_revenue > 0
      ORDER BY total_revenue DESC
      LIMIT 5
    `).all();

    // Recent 10 invoices
    const recentInvoices = db.prepare(`
      SELECT i.id, i.invoice_number, i.invoice_date, i.invoice_type,
             i.grand_total, i.status, i.amount_paid,
             c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `).all();

    // GST liability (current month)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const gstLiability = db.prepare(`
      SELECT
        COALESCE(SUM(cgst_total), 0) as cgst,
        COALESCE(SUM(sgst_total), 0) as sgst,
        COALESCE(SUM(igst_total), 0) as igst,
        COALESCE(SUM(total_tax), 0) as total_tax
      FROM invoices
      WHERE invoice_type IN ('tax_invoice')
        AND status != 'cancelled'
        AND strftime('%Y-%m', invoice_date) = ?
    `).get(currentMonth);

    res.json({
      total_sales: totalSales.total,
      total_receivables: totalReceivables.total,
      invoices_count: invoicesCount.count,
      customers_count: customersCount.count,
      monthly_sales: monthlySales,
      top_customers: topCustomers,
      recent_invoices: recentInvoices,
      gst_liability: gstLiability
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/reports/gstr1 — outward supplies summary grouped by rate, with date range params
router.get('/gstr1', (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    // B2B Supplies (to registered persons, i.e., customers with GSTIN)
    const b2b = db.prepare(`
      SELECT
        c.name as customer_name, c.gstin as customer_gstin,
        i.invoice_number, i.invoice_date, i.invoice_type,
        i.subtotal, i.cgst_total, i.sgst_total, i.igst_total,
        i.total_tax, i.grand_total, i.place_of_supply, i.is_reverse_charge
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.invoice_type IN ('tax_invoice', 'credit_note', 'debit_note')
        AND i.status != 'cancelled'
        AND i.invoice_date >= ? AND i.invoice_date <= ?
        AND c.gstin IS NOT NULL AND c.gstin != ''
      ORDER BY i.invoice_date ASC
    `).all(from_date, to_date);

    // B2C Supplies (to unregistered persons, i.e., customers without GSTIN)
    const b2c = db.prepare(`
      SELECT
        i.invoice_number, i.invoice_date,
        i.subtotal, i.cgst_total, i.sgst_total, i.igst_total,
        i.total_tax, i.grand_total, i.place_of_supply,
        c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.invoice_type IN ('tax_invoice', 'bill_of_supply')
        AND i.status != 'cancelled'
        AND i.invoice_date >= ? AND i.invoice_date <= ?
        AND (c.gstin IS NULL OR c.gstin = '')
      ORDER BY i.invoice_date ASC
    `).all(from_date, to_date);

    // Rate-wise summary
    const rateSummary = db.prepare(`
      SELECT
        ii.gst_rate,
        COUNT(DISTINCT i.id) as invoice_count,
        COALESCE(SUM(ii.taxable_amount), 0) as taxable_value,
        COALESCE(SUM(ii.cgst_amount), 0) as cgst,
        COALESCE(SUM(ii.sgst_amount), 0) as sgst,
        COALESCE(SUM(ii.igst_amount), 0) as igst,
        COALESCE(SUM(ii.total), 0) as total
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.invoice_type IN ('tax_invoice')
        AND i.status != 'cancelled'
        AND i.invoice_date >= ? AND i.invoice_date <= ?
      GROUP BY ii.gst_rate
      ORDER BY ii.gst_rate ASC
    `).all(from_date, to_date);

    // Credit/Debit note summary
    const cdnSummary = db.prepare(`
      SELECT
        i.invoice_type,
        COUNT(*) as count,
        COALESCE(SUM(i.subtotal), 0) as taxable_value,
        COALESCE(SUM(i.cgst_total), 0) as cgst,
        COALESCE(SUM(i.sgst_total), 0) as sgst,
        COALESCE(SUM(i.igst_total), 0) as igst,
        COALESCE(SUM(i.grand_total), 0) as total
      FROM invoices i
      WHERE i.invoice_type IN ('credit_note', 'debit_note')
        AND i.status != 'cancelled'
        AND i.invoice_date >= ? AND i.invoice_date <= ?
      GROUP BY i.invoice_type
    `).all(from_date, to_date);

    // Overall totals
    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(subtotal), 0) as total_taxable,
        COALESCE(SUM(cgst_total), 0) as total_cgst,
        COALESCE(SUM(sgst_total), 0) as total_sgst,
        COALESCE(SUM(igst_total), 0) as total_igst,
        COALESCE(SUM(total_tax), 0) as total_tax,
        COALESCE(SUM(grand_total), 0) as total_value
      FROM invoices
      WHERE invoice_type IN ('tax_invoice')
        AND status != 'cancelled'
        AND invoice_date >= ? AND invoice_date <= ?
    `).get(from_date, to_date);

    res.json({
      b2b,
      b2c,
      rate_summary: rateSummary,
      cdn_summary: cdnSummary,
      totals
    });
  } catch (err) {
    console.error('Error fetching GSTR-1 report:', err.message);
    res.status(500).json({ error: 'Failed to fetch GSTR-1 report' });
  }
});

// GET /api/reports/gstr3b — tax liability summary with ITC, with date range params
router.get('/gstr3b', (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    // 3.1 Outward supplies (taxable)
    const outwardTaxable = db.prepare(`
      SELECT
        COALESCE(SUM(subtotal), 0) as taxable_value,
        COALESCE(SUM(igst_total), 0) as igst,
        COALESCE(SUM(cgst_total), 0) as cgst,
        COALESCE(SUM(sgst_total), 0) as sgst,
        COALESCE(SUM(total_tax), 0) as total_tax
      FROM invoices
      WHERE invoice_type = 'tax_invoice'
        AND status != 'cancelled'
        AND invoice_date >= ? AND invoice_date <= ?
    `).get(from_date, to_date);

    // Outward supplies (exempt / nil rated — bill of supply)
    const outwardExempt = db.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) as total_value,
        COUNT(*) as count
      FROM invoices
      WHERE invoice_type = 'bill_of_supply'
        AND status != 'cancelled'
        AND invoice_date >= ? AND invoice_date <= ?
    `).get(from_date, to_date);

    // Credit notes
    const creditNotes = db.prepare(`
      SELECT
        COALESCE(SUM(subtotal), 0) as taxable_value,
        COALESCE(SUM(igst_total), 0) as igst,
        COALESCE(SUM(cgst_total), 0) as cgst,
        COALESCE(SUM(sgst_total), 0) as sgst,
        COALESCE(SUM(total_tax), 0) as total_tax
      FROM invoices
      WHERE invoice_type = 'credit_note'
        AND status != 'cancelled'
        AND invoice_date >= ? AND invoice_date <= ?
    `).get(from_date, to_date);

    // Debit notes
    const debitNotes = db.prepare(`
      SELECT
        COALESCE(SUM(subtotal), 0) as taxable_value,
        COALESCE(SUM(igst_total), 0) as igst,
        COALESCE(SUM(cgst_total), 0) as cgst,
        COALESCE(SUM(sgst_total), 0) as sgst,
        COALESCE(SUM(total_tax), 0) as total_tax
      FROM invoices
      WHERE invoice_type = 'debit_note'
        AND status != 'cancelled'
        AND invoice_date >= ? AND invoice_date <= ?
    `).get(from_date, to_date);

    // 4. ITC (Input Tax Credit) — from purchase orders marked as received
    const itcAvailable = db.prepare(`
      SELECT
        COALESCE(SUM(igst_total), 0) as igst,
        COALESCE(SUM(cgst_total), 0) as cgst,
        COALESCE(SUM(sgst_total), 0) as sgst,
        COALESCE(SUM(total_tax), 0) as total_tax
      FROM purchase_orders
      WHERE status = 'received'
        AND po_date >= ? AND po_date <= ?
    `).get(from_date, to_date);

    // Net tax liability
    const netLiability = {
      igst: (outwardTaxable.igst || 0) + (debitNotes.igst || 0) - (creditNotes.igst || 0) - (itcAvailable.igst || 0),
      cgst: (outwardTaxable.cgst || 0) + (debitNotes.cgst || 0) - (creditNotes.cgst || 0) - (itcAvailable.cgst || 0),
      sgst: (outwardTaxable.sgst || 0) + (debitNotes.sgst || 0) - (creditNotes.sgst || 0) - (itcAvailable.sgst || 0),
    };
    netLiability.total = netLiability.igst + netLiability.cgst + netLiability.sgst;

    res.json({
      outward_taxable: outwardTaxable,
      outward_exempt: outwardExempt,
      credit_notes: creditNotes,
      debit_notes: debitNotes,
      itc_available: itcAvailable,
      net_liability: netLiability
    });
  } catch (err) {
    console.error('Error fetching GSTR-3B report:', err.message);
    res.status(500).json({ error: 'Failed to fetch GSTR-3B report' });
  }
});

// GET /api/reports/hsn-summary — HSN-wise summary with date range params
router.get('/hsn-summary', (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    const hsnSummary = db.prepare(`
      SELECT
        ii.hsn_sac,
        ii.gst_rate,
        ii.unit,
        SUM(ii.quantity) as total_quantity,
        COALESCE(SUM(ii.taxable_amount), 0) as taxable_value,
        COALESCE(SUM(ii.cgst_amount), 0) as cgst,
        COALESCE(SUM(ii.sgst_amount), 0) as sgst,
        COALESCE(SUM(ii.igst_amount), 0) as igst,
        COALESCE(SUM(ii.cgst_amount + ii.sgst_amount + ii.igst_amount), 0) as total_tax,
        COALESCE(SUM(ii.total), 0) as total_value
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.invoice_type IN ('tax_invoice')
        AND i.status != 'cancelled'
        AND i.invoice_date >= ? AND i.invoice_date <= ?
        AND ii.hsn_sac IS NOT NULL AND ii.hsn_sac != ''
      GROUP BY ii.hsn_sac, ii.gst_rate, ii.unit
      ORDER BY ii.hsn_sac ASC
    `).all(from_date, to_date);

    // Grand totals
    const grandTotals = db.prepare(`
      SELECT
        SUM(ii.quantity) as total_quantity,
        COALESCE(SUM(ii.taxable_amount), 0) as taxable_value,
        COALESCE(SUM(ii.cgst_amount), 0) as cgst,
        COALESCE(SUM(ii.sgst_amount), 0) as sgst,
        COALESCE(SUM(ii.igst_amount), 0) as igst,
        COALESCE(SUM(ii.cgst_amount + ii.sgst_amount + ii.igst_amount), 0) as total_tax,
        COALESCE(SUM(ii.total), 0) as total_value
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.invoice_type IN ('tax_invoice')
        AND i.status != 'cancelled'
        AND i.invoice_date >= ? AND i.invoice_date <= ?
        AND ii.hsn_sac IS NOT NULL AND ii.hsn_sac != ''
    `).get(from_date, to_date);

    res.json({
      items: hsnSummary,
      totals: grandTotals
    });
  } catch (err) {
    console.error('Error fetching HSN summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch HSN summary' });
  }
});

export default router;
