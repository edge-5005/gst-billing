import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/suppliers — list all (with search)
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let suppliers;

    if (search) {
      suppliers = db.prepare(`
        SELECT * FROM suppliers
        WHERE name LIKE ? OR gstin LIKE ? OR phone LIKE ? OR email LIKE ?
        ORDER BY name ASC
      `).all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    } else {
      suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
    }

    res.json(suppliers);
  } catch (err) {
    console.error('Error fetching suppliers:', err.message);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// GET /api/suppliers/:id — get one
router.get('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const poCount = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?').get(req.params.id);

    res.json({
      ...supplier,
      po_count: poCount.count
    });
  } catch (err) {
    console.error('Error fetching supplier:', err.message);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
});

// POST /api/suppliers — create
router.post('/', (req, res) => {
  try {
    const { name, gstin, pan, phone, email, address, city, state, state_code, pincode } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO suppliers (name, gstin, pan, phone, email, address, city, state, state_code, pincode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(), gstin || '', pan || '', phone || '', email || '',
      address || '', city || '', state || '', state_code || '', pincode || ''
    );

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(supplier);
  } catch (err) {
    console.error('Error creating supplier:', err.message);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/suppliers/:id — update
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const { name, gstin, pan, phone, email, address, city, state, state_code, pincode } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const stmt = db.prepare(`
      UPDATE suppliers SET
        name = ?, gstin = ?, pan = ?, phone = ?, email = ?,
        address = ?, city = ?, state = ?, state_code = ?, pincode = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      name.trim(), gstin || '', pan || '', phone || '', email || '',
      address || '', city || '', state || '', state_code || '', pincode || '',
      req.params.id
    );

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    res.json(supplier);
  } catch (err) {
    console.error('Error updating supplier:', err.message);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/suppliers/:id — delete (check for POs first)
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const poCheck = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?').get(req.params.id);
    if (poCheck.count > 0) {
      return res.status(400).json({ error: `Cannot delete supplier. ${poCheck.count} purchase order(s) are linked to this supplier.` });
    }

    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    console.error('Error deleting supplier:', err.message);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

export default router;
