import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/customers — list all (with search query param)
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let customers;

    if (search) {
      customers = db.prepare(`
        SELECT * FROM customers
        WHERE name LIKE ? OR gstin LIKE ? OR phone LIKE ? OR email LIKE ?
        ORDER BY name ASC
      `).all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    }

    res.json(customers);
  } catch (err) {
    console.error('Error fetching customers:', err.message);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/customers/:id — get one with outstanding balance
router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Calculate outstanding balance
    const outstanding = db.prepare(`
      SELECT COALESCE(SUM(grand_total - amount_paid), 0) as outstanding_balance
      FROM invoices
      WHERE customer_id = ? AND status != 'cancelled'
        AND invoice_type IN ('tax_invoice', 'bill_of_supply')
    `).get(req.params.id);

    const invoiceCount = db.prepare(`
      SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?
    `).get(req.params.id);

    res.json({
      ...customer,
      outstanding_balance: outstanding.outstanding_balance,
      invoice_count: invoiceCount.count
    });
  } catch (err) {
    console.error('Error fetching customer:', err.message);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST /api/customers — create
router.post('/', (req, res) => {
  try {
    const {
      name, gstin, pan, phone, email,
      billing_address, billing_city, billing_state, billing_state_code, billing_pincode,
      shipping_address, shipping_city, shipping_state, shipping_state_code, shipping_pincode
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO customers (
        name, gstin, pan, phone, email,
        billing_address, billing_city, billing_state, billing_state_code, billing_pincode,
        shipping_address, shipping_city, shipping_state, shipping_state_code, shipping_pincode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(), gstin || '', pan || '', phone || '', email || '',
      billing_address || '', billing_city || '', billing_state || '', billing_state_code || '', billing_pincode || '',
      shipping_address || '', shipping_city || '', shipping_state || '', shipping_state_code || '', shipping_pincode || ''
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer:', err.message);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /api/customers/:id — update
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const {
      name, gstin, pan, phone, email,
      billing_address, billing_city, billing_state, billing_state_code, billing_pincode,
      shipping_address, shipping_city, shipping_state, shipping_state_code, shipping_pincode
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const stmt = db.prepare(`
      UPDATE customers SET
        name = ?, gstin = ?, pan = ?, phone = ?, email = ?,
        billing_address = ?, billing_city = ?, billing_state = ?,
        billing_state_code = ?, billing_pincode = ?,
        shipping_address = ?, shipping_city = ?, shipping_state = ?,
        shipping_state_code = ?, shipping_pincode = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      name.trim(), gstin || '', pan || '', phone || '', email || '',
      billing_address || '', billing_city || '', billing_state || '', billing_state_code || '', billing_pincode || '',
      shipping_address || '', shipping_city || '', shipping_state || '', shipping_state_code || '', shipping_pincode || '',
      req.params.id
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(customer);
  } catch (err) {
    console.error('Error updating customer:', err.message);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /api/customers/:id — delete (check for invoices first)
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const invoiceCheck = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?').get(req.params.id);
    if (invoiceCheck.count > 0) {
      return res.status(400).json({ error: `Cannot delete customer. ${invoiceCheck.count} invoice(s) are linked to this customer.` });
    }

    const quotationCheck = db.prepare('SELECT COUNT(*) as count FROM quotations WHERE customer_id = ?').get(req.params.id);
    if (quotationCheck.count > 0) {
      return res.status(400).json({ error: `Cannot delete customer. ${quotationCheck.count} quotation(s) are linked to this customer.` });
    }

    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err.message);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
