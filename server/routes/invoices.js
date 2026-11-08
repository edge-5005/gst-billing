import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Helper: generate next invoice number
function getNextInvoiceNumber(invoiceType) {
  const year = new Date().getFullYear();
  const prefixMap = {
    tax_invoice: 'INV',
    bill_of_supply: 'BOS',
    credit_note: 'CN',
    debit_note: 'DN'
  };
  const prefix = prefixMap[invoiceType] || 'INV';
  const pattern = `${prefix}-${year}-%`;

  const last = db.prepare(`
    SELECT invoice_number FROM invoices
    WHERE invoice_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(pattern);

  let nextNum = 1;
  if (last) {
    const parts = last.invoice_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
}

// Helper: update product stock
function updateStock(productId, quantity, operation) {
  if (!productId) return;
  if (operation === 'decrease') {
    db.prepare('UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime(\'now\') WHERE id = ?').run(quantity, productId);
  } else if (operation === 'increase') {
    db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = datetime(\'now\') WHERE id = ?').run(quantity, productId);
  }
}

// GET /api/invoices/next-number/:type — get next invoice number
router.get('/next-number/:type', (req, res) => {
  try {
    const invoiceType = req.params.type;
    const nextNumber = getNextInvoiceNumber(invoiceType);
    res.json({ next_number: nextNumber });
  } catch (err) {
    console.error('Error generating next invoice number:', err.message);
    res.status(500).json({ error: 'Failed to generate next invoice number' });
  }
});

// GET /api/invoices — list all with customer name joined (filter by type, status, date range)
router.get('/', (req, res) => {
  try {
    const { type, status, from_date, to_date, search } = req.query;
    let query = `
      SELECT i.*, c.name as customer_name, c.gstin as customer_gstin
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND i.invoice_type = ?';
      params.push(type);
    }

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (from_date) {
      query += ' AND i.invoice_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND i.invoice_date <= ?';
      params.push(to_date);
    }

    if (search) {
      query += ' AND (i.invoice_number LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY i.created_at DESC';

    const invoices = db.prepare(query).all(...params);
    res.json(invoices);
  } catch (err) {
    console.error('Error fetching invoices:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id — get one with items and customer details
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name, c.gstin as customer_gstin, c.pan as customer_pan,
             c.phone as customer_phone, c.email as customer_email,
             c.billing_address, c.billing_city, c.billing_state, c.billing_state_code, c.billing_pincode,
             c.shipping_address, c.shipping_city, c.shipping_state, c.shipping_state_code, c.shipping_pincode
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const items = db.prepare(`
      SELECT ii.*, p.name as product_name
      FROM invoice_items ii
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE ii.invoice_id = ?
      ORDER BY ii.id ASC
    `).all(req.params.id);

    const payments = db.prepare(`
      SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
    `).all(req.params.id);

    res.json({ ...invoice, items, payments });
  } catch (err) {
    console.error('Error fetching invoice:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoices — create with items (auto-generate invoice number, handle stock)
router.post('/', (req, res) => {
  try {
    const {
      invoice_date, due_date, customer_id, invoice_type, reference_invoice_id,
      place_of_supply, place_of_supply_code, is_reverse_charge,
      subtotal, discount_amount, cgst_total, sgst_total, igst_total,
      total_tax, grand_total, notes, terms, reason, items
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'Customer is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    if (!invoice_date) {
      return res.status(400).json({ error: 'Invoice date is required' });
    }

    const invoice_number = getNextInvoiceNumber(invoice_type || 'tax_invoice');

    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        invoice_number, invoice_date, due_date, customer_id, invoice_type,
        reference_invoice_id, place_of_supply, place_of_supply_code, is_reverse_charge,
        subtotal, discount_amount, cgst_total, sgst_total, igst_total,
        total_tax, grand_total, amount_paid, status, notes, terms, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (
        invoice_id, product_id, description, hsn_sac, quantity, unit, rate,
        discount_percent, discount_amount, taxable_amount, gst_rate,
        cgst_amount, sgst_amount, igst_amount, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      const result = insertInvoice.run(
        invoice_number, invoice_date, due_date || '', customer_id, invoice_type || 'tax_invoice',
        reference_invoice_id || null, place_of_supply || '', place_of_supply_code || '',
        is_reverse_charge ? 1 : 0,
        subtotal || 0, discount_amount || 0, cgst_total || 0, sgst_total || 0, igst_total || 0,
        total_tax || 0, grand_total || 0, notes || '', terms || '', reason || ''
      );

      const invoiceId = result.lastInsertRowid;

      for (const item of items) {
        insertItem.run(
          invoiceId, item.product_id || null, item.description || '', item.hsn_sac || '',
          item.quantity || 0, item.unit || 'PCS', item.rate || 0,
          item.discount_percent || 0, item.discount_amount || 0, item.taxable_amount || 0,
          item.gst_rate || 0, item.cgst_amount || 0, item.sgst_amount || 0,
          item.igst_amount || 0, item.total || 0
        );

        // Decrease stock for regular invoices (tax_invoice, bill_of_supply)
        if (item.product_id && (invoice_type === 'tax_invoice' || invoice_type === 'bill_of_supply')) {
          updateStock(item.product_id, item.quantity || 0, 'decrease');
        }
        // Increase stock for credit notes (goods returned)
        if (item.product_id && invoice_type === 'credit_note') {
          updateStock(item.product_id, item.quantity || 0, 'increase');
        }
      }

      return invoiceId;
    });

    const invoiceId = transaction();

    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(invoiceId);

    const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);

    res.status(201).json({ ...invoice, items: invoiceItems });
  } catch (err) {
    console.error('Error creating invoice:', err.message);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /api/invoices/:id — update with items
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const {
      invoice_date, due_date, customer_id, invoice_type,
      reference_invoice_id, place_of_supply, place_of_supply_code, is_reverse_charge,
      subtotal, discount_amount, cgst_total, sgst_total, igst_total,
      total_tax, grand_total, status, notes, terms, reason, items
    } = req.body;

    const transaction = db.transaction(() => {
      // Restore stock from old items
      const oldItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
      for (const oldItem of oldItems) {
        if (oldItem.product_id) {
          if (existing.invoice_type === 'tax_invoice' || existing.invoice_type === 'bill_of_supply') {
            updateStock(oldItem.product_id, oldItem.quantity, 'increase');
          } else if (existing.invoice_type === 'credit_note') {
            updateStock(oldItem.product_id, oldItem.quantity, 'decrease');
          }
        }
      }

      // Delete old items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);

      // Update invoice
      const effectiveType = invoice_type || existing.invoice_type;
      db.prepare(`
        UPDATE invoices SET
          invoice_date = ?, due_date = ?, customer_id = ?, invoice_type = ?,
          reference_invoice_id = ?, place_of_supply = ?, place_of_supply_code = ?,
          is_reverse_charge = ?, subtotal = ?, discount_amount = ?,
          cgst_total = ?, sgst_total = ?, igst_total = ?,
          total_tax = ?, grand_total = ?, status = ?,
          notes = ?, terms = ?, reason = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        invoice_date || existing.invoice_date, due_date || '', customer_id || existing.customer_id,
        effectiveType, reference_invoice_id || null,
        place_of_supply || '', place_of_supply_code || '', is_reverse_charge ? 1 : 0,
        subtotal || 0, discount_amount || 0, cgst_total || 0, sgst_total || 0, igst_total || 0,
        total_tax || 0, grand_total || 0, status || existing.status,
        notes || '', terms || '', reason || '',
        req.params.id
      );

      // Insert new items and handle stock
      if (items && items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO invoice_items (
            invoice_id, product_id, description, hsn_sac, quantity, unit, rate,
            discount_percent, discount_amount, taxable_amount, gst_rate,
            cgst_amount, sgst_amount, igst_amount, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          insertItem.run(
            req.params.id, item.product_id || null, item.description || '', item.hsn_sac || '',
            item.quantity || 0, item.unit || 'PCS', item.rate || 0,
            item.discount_percent || 0, item.discount_amount || 0, item.taxable_amount || 0,
            item.gst_rate || 0, item.cgst_amount || 0, item.sgst_amount || 0,
            item.igst_amount || 0, item.total || 0
          );

          if (item.product_id) {
            if (effectiveType === 'tax_invoice' || effectiveType === 'bill_of_supply') {
              updateStock(item.product_id, item.quantity || 0, 'decrease');
            } else if (effectiveType === 'credit_note') {
              updateStock(item.product_id, item.quantity || 0, 'increase');
            }
          }
        }
      }
    });

    transaction();

    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(req.params.id);

    const updatedItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);

    res.json({ ...invoice, items: updatedItems });
  } catch (err) {
    console.error('Error updating invoice:', err.message);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DELETE /api/invoices/:id — delete (restore stock)
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const transaction = db.transaction(() => {
      // Restore stock
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
      for (const item of items) {
        if (item.product_id) {
          if (existing.invoice_type === 'tax_invoice' || existing.invoice_type === 'bill_of_supply') {
            updateStock(item.product_id, item.quantity, 'increase');
          } else if (existing.invoice_type === 'credit_note') {
            updateStock(item.product_id, item.quantity, 'decrease');
          }
        }
      }

      // Delete related payments
      db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(req.params.id);
      // Delete invoice (items cascade)
      db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    });

    transaction();
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    console.error('Error deleting invoice:', err.message);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;
