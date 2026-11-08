import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Helper: generate next quotation number
function getNextQuotationNumber() {
  const year = new Date().getFullYear();
  const pattern = `QTN-${year}-%`;

  const last = db.prepare(`
    SELECT quotation_number FROM quotations
    WHERE quotation_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(pattern);

  let nextNum = 1;
  if (last) {
    const parts = last.quotation_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `QTN-${year}-${String(nextNum).padStart(4, '0')}`;
}

// GET /api/quotations — list all with customer name
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT q.*, c.name as customer_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND q.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (q.quotation_number LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY q.created_at DESC';

    const quotations = db.prepare(query).all(...params);
    res.json(quotations);
  } catch (err) {
    console.error('Error fetching quotations:', err.message);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
});

// GET /api/quotations/:id — get one with items
router.get('/:id', (req, res) => {
  try {
    const quotation = db.prepare(`
      SELECT q.*, c.name as customer_name, c.gstin as customer_gstin,
             c.phone as customer_phone, c.email as customer_email,
             c.billing_address, c.billing_city, c.billing_state,
             c.billing_state_code, c.billing_pincode,
             c.shipping_address, c.shipping_city, c.shipping_state,
             c.shipping_state_code, c.shipping_pincode
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ?
    `).get(req.params.id);

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const items = db.prepare(`
      SELECT qi.*, p.name as product_name
      FROM quotation_items qi
      LEFT JOIN products p ON qi.product_id = p.id
      WHERE qi.quotation_id = ?
      ORDER BY qi.id ASC
    `).all(req.params.id);

    res.json({ ...quotation, items });
  } catch (err) {
    console.error('Error fetching quotation:', err.message);
    res.status(500).json({ error: 'Failed to fetch quotation' });
  }
});

// POST /api/quotations — create with items
router.post('/', (req, res) => {
  try {
    const {
      quotation_date, valid_until, customer_id,
      subtotal, discount_amount, cgst_total, sgst_total, igst_total,
      total_tax, grand_total, notes, terms, items
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'Customer is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    if (!quotation_date) {
      return res.status(400).json({ error: 'Quotation date is required' });
    }

    const quotation_number = getNextQuotationNumber();

    const insertQuotation = db.prepare(`
      INSERT INTO quotations (
        quotation_number, quotation_date, valid_until, customer_id,
        subtotal, discount_amount, cgst_total, sgst_total, igst_total,
        total_tax, grand_total, status, notes, terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, product_id, description, hsn_sac, quantity, unit, rate,
        discount_percent, discount_amount, taxable_amount, gst_rate,
        cgst_amount, sgst_amount, igst_amount, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      const result = insertQuotation.run(
        quotation_number, quotation_date, valid_until || '', customer_id,
        subtotal || 0, discount_amount || 0, cgst_total || 0, sgst_total || 0,
        igst_total || 0, total_tax || 0, grand_total || 0, notes || '', terms || ''
      );

      const quotationId = result.lastInsertRowid;

      for (const item of items) {
        insertItem.run(
          quotationId, item.product_id || null, item.description || '', item.hsn_sac || '',
          item.quantity || 0, item.unit || 'PCS', item.rate || 0,
          item.discount_percent || 0, item.discount_amount || 0, item.taxable_amount || 0,
          item.gst_rate || 0, item.cgst_amount || 0, item.sgst_amount || 0,
          item.igst_amount || 0, item.total || 0
        );
      }

      return quotationId;
    });

    const quotationId = transaction();

    const quotation = db.prepare(`
      SELECT q.*, c.name as customer_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ?
    `).get(quotationId);

    const quotationItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(quotationId);

    res.status(201).json({ ...quotation, items: quotationItems });
  } catch (err) {
    console.error('Error creating quotation:', err.message);
    res.status(500).json({ error: 'Failed to create quotation' });
  }
});

// PUT /api/quotations/:id — update
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const {
      quotation_date, valid_until, customer_id,
      subtotal, discount_amount, cgst_total, sgst_total, igst_total,
      total_tax, grand_total, status, notes, terms, items
    } = req.body;

    const transaction = db.transaction(() => {
      // Delete old items
      db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(req.params.id);

      // Update quotation
      db.prepare(`
        UPDATE quotations SET
          quotation_date = ?, valid_until = ?, customer_id = ?,
          subtotal = ?, discount_amount = ?,
          cgst_total = ?, sgst_total = ?, igst_total = ?,
          total_tax = ?, grand_total = ?, status = ?,
          notes = ?, terms = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        quotation_date || existing.quotation_date, valid_until || '', customer_id || existing.customer_id,
        subtotal || 0, discount_amount || 0, cgst_total || 0, sgst_total || 0,
        igst_total || 0, total_tax || 0, grand_total || 0, status || existing.status,
        notes || '', terms || '',
        req.params.id
      );

      // Insert new items
      if (items && items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO quotation_items (
            quotation_id, product_id, description, hsn_sac, quantity, unit, rate,
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
        }
      }
    });

    transaction();

    const quotation = db.prepare(`
      SELECT q.*, c.name as customer_name
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ?
    `).get(req.params.id);

    const updatedItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(req.params.id);

    res.json({ ...quotation, items: updatedItems });
  } catch (err) {
    console.error('Error updating quotation:', err.message);
    res.status(500).json({ error: 'Failed to update quotation' });
  }
});

// DELETE /api/quotations/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    db.prepare('DELETE FROM quotations WHERE id = ?').run(req.params.id);
    res.json({ message: 'Quotation deleted successfully' });
  } catch (err) {
    console.error('Error deleting quotation:', err.message);
    res.status(500).json({ error: 'Failed to delete quotation' });
  }
});

// POST /api/quotations/:id/convert — convert to invoice
router.post('/:id/convert', (req, res) => {
  try {
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (quotation.status === 'converted') {
      return res.status(400).json({ error: 'Quotation has already been converted to an invoice' });
    }

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(req.params.id);

    // Generate invoice number
    const year = new Date().getFullYear();
    const pattern = `INV-${year}-%`;
    const last = db.prepare(`
      SELECT invoice_number FROM invoices
      WHERE invoice_number LIKE ?
      ORDER BY id DESC LIMIT 1
    `).get(pattern);

    let nextNum = 1;
    if (last) {
      const parts = last.invoice_number.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    const invoice_number = `INV-${year}-${String(nextNum).padStart(4, '0')}`;

    // Get customer for place of supply
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(quotation.customer_id);
    const company = db.prepare('SELECT * FROM company WHERE id = 1').get();

    const today = new Date().toISOString().split('T')[0];

    const transaction = db.transaction(() => {
      // Create invoice
      const result = db.prepare(`
        INSERT INTO invoices (
          invoice_number, invoice_date, due_date, customer_id, invoice_type,
          place_of_supply, place_of_supply_code, is_reverse_charge,
          subtotal, discount_amount, cgst_total, sgst_total, igst_total,
          total_tax, grand_total, amount_paid, status, notes, terms
        ) VALUES (?, ?, '', ?, 'tax_invoice', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?)
      `).run(
        invoice_number, today, quotation.customer_id,
        customer ? customer.billing_state : '', customer ? customer.billing_state_code : '',
        quotation.subtotal, quotation.discount_amount,
        quotation.cgst_total, quotation.sgst_total, quotation.igst_total,
        quotation.total_tax, quotation.grand_total,
        quotation.notes, quotation.terms
      );

      const invoiceId = result.lastInsertRowid;

      // Copy items
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (
          invoice_id, product_id, description, hsn_sac, quantity, unit, rate,
          discount_percent, discount_amount, taxable_amount, gst_rate,
          cgst_amount, sgst_amount, igst_amount, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          invoiceId, item.product_id, item.description, item.hsn_sac,
          item.quantity, item.unit, item.rate,
          item.discount_percent, item.discount_amount, item.taxable_amount,
          item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount, item.total
        );

        // Decrease stock
        if (item.product_id) {
          db.prepare('UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(item.quantity, item.product_id);
        }
      }

      // Mark quotation as converted
      db.prepare(`
        UPDATE quotations SET status = 'converted', updated_at = datetime('now') WHERE id = ?
      `).run(req.params.id);

      return invoiceId;
    });

    const invoiceId = transaction();

    const invoice = db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(invoiceId);

    res.status(201).json(invoice);
  } catch (err) {
    console.error('Error converting quotation:', err.message);
    res.status(500).json({ error: 'Failed to convert quotation to invoice' });
  }
});

export default router;
