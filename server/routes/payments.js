import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Helper: recalculate invoice payment status
function updateInvoicePaymentStatus(invoiceId) {
  const invoice = db.prepare('SELECT grand_total, amount_paid FROM invoices WHERE id = ?').get(invoiceId);
  if (!invoice) return;

  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ?').get(invoiceId);
  const amountPaid = totalPaid.total;

  let status;
  if (amountPaid <= 0) {
    status = 'unpaid';
  } else if (amountPaid >= invoice.grand_total) {
    status = 'paid';
  } else {
    status = 'partial';
  }

  db.prepare('UPDATE invoices SET amount_paid = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(amountPaid, status, invoiceId);
}

// GET /api/payments — list all with invoice details
router.get('/', (req, res) => {
  try {
    const { from_date, to_date, payment_mode } = req.query;
    let query = `
      SELECT p.*, i.invoice_number, i.grand_total as invoice_total,
             c.name as customer_name
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (from_date) {
      query += ' AND p.payment_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND p.payment_date <= ?';
      params.push(to_date);
    }

    if (payment_mode) {
      query += ' AND p.payment_mode = ?';
      params.push(payment_mode);
    }

    query += ' ORDER BY p.created_at DESC';

    const payments = db.prepare(query).all(...params);
    res.json(payments);
  } catch (err) {
    console.error('Error fetching payments:', err.message);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /api/payments/invoice/:invoiceId — payments for an invoice
router.get('/invoice/:invoiceId', (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
    `).all(req.params.invoiceId);
    res.json(payments);
  } catch (err) {
    console.error('Error fetching invoice payments:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice payments' });
  }
});

// POST /api/payments — create payment (update invoice amount_paid and status)
router.post('/', (req, res) => {
  try {
    const { invoice_id, payment_date, amount, payment_mode, reference_number, notes } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'Invoice is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' });
    }

    if (!payment_date) {
      return res.status(400).json({ error: 'Payment date is required' });
    }

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const remaining = invoice.grand_total - invoice.amount_paid;
    if (amount > remaining + 0.01) {
      return res.status(400).json({
        error: `Payment amount (₹${amount.toFixed(2)}) exceeds remaining balance (₹${remaining.toFixed(2)})`
      });
    }

    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO payments (invoice_id, payment_date, amount, payment_mode, reference_number, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(invoice_id, payment_date, amount, payment_mode || 'cash', reference_number || '', notes || '');

      updateInvoicePaymentStatus(invoice_id);

      return result.lastInsertRowid;
    });

    const paymentId = transaction();

    const payment = db.prepare(`
      SELECT p.*, i.invoice_number, c.name as customer_name
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE p.id = ?
    `).get(paymentId);

    res.status(201).json(payment);
  } catch (err) {
    console.error('Error creating payment:', err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// DELETE /api/payments/:id — delete (update invoice)
router.delete('/:id', (req, res) => {
  try {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
      updateInvoicePaymentStatus(payment.invoice_id);
    });

    transaction();
    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error('Error deleting payment:', err.message);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

export default router;
