import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Helper: generate next PO number
function getNextPONumber() {
  const year = new Date().getFullYear();
  const pattern = `PO-${year}-%`;

  const last = db.prepare(`
    SELECT po_number FROM purchase_orders
    WHERE po_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(pattern);

  let nextNum = 1;
  if (last) {
    const parts = last.po_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `PO-${year}-${String(nextNum).padStart(4, '0')}`;
}

// GET /api/purchase-orders — list all with supplier name
router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND po.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (po.po_number LIKE ? OR s.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY po.created_at DESC';

    const orders = db.prepare(query).all(...params);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching purchase orders:', err.message);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// GET /api/purchase-orders/:id — get one with items
router.get('/:id', (req, res) => {
  try {
    const po = db.prepare(`
      SELECT po.*, s.name as supplier_name, s.gstin as supplier_gstin,
             s.phone as supplier_phone, s.email as supplier_email,
             s.address as supplier_address, s.city as supplier_city,
             s.state as supplier_state, s.state_code as supplier_state_code,
             s.pincode as supplier_pincode
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
    `).get(req.params.id);

    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const items = db.prepare(`
      SELECT pi.*, p.name as product_name
      FROM po_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.po_id = ?
      ORDER BY pi.id ASC
    `).all(req.params.id);

    res.json({ ...po, items });
  } catch (err) {
    console.error('Error fetching purchase order:', err.message);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// POST /api/purchase-orders — create with items
router.post('/', (req, res) => {
  try {
    const {
      po_date, expected_date, supplier_id,
      subtotal, discount_amount, cgst_total, sgst_total, igst_total,
      total_tax, grand_total, notes, terms, items
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ error: 'Supplier is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    if (!po_date) {
      return res.status(400).json({ error: 'Purchase order date is required' });
    }

    const po_number = getNextPONumber();

    const insertPO = db.prepare(`
      INSERT INTO purchase_orders (
        po_number, po_date, expected_date, supplier_id,
        subtotal, discount_amount, cgst_total, sgst_total, igst_total,
        total_tax, grand_total, status, notes, terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO po_items (
        po_id, product_id, description, hsn_sac, quantity, unit, rate,
        discount_percent, discount_amount, taxable_amount, gst_rate,
        cgst_amount, sgst_amount, igst_amount, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      const result = insertPO.run(
        po_number, po_date, expected_date || '', supplier_id,
        subtotal || 0, discount_amount || 0, cgst_total || 0, sgst_total || 0,
        igst_total || 0, total_tax || 0, grand_total || 0, notes || '', terms || ''
      );

      const poId = result.lastInsertRowid;

      for (const item of items) {
        insertItem.run(
          poId, item.product_id || null, item.description || '', item.hsn_sac || '',
          item.quantity || 0, item.unit || 'PCS', item.rate || 0,
          item.discount_percent || 0, item.discount_amount || 0, item.taxable_amount || 0,
          item.gst_rate || 0, item.cgst_amount || 0, item.sgst_amount || 0,
          item.igst_amount || 0, item.total || 0
        );
      }

      return poId;
    });

    const poId = transaction();

    const po = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
    `).get(poId);

    const poItems = db.prepare('SELECT * FROM po_items WHERE po_id = ?').all(poId);

    res.status(201).json({ ...po, items: poItems });
  } catch (err) {
    console.error('Error creating purchase order:', err.message);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// PUT /api/purchase-orders/:id — update
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const {
      po_date, expected_date, supplier_id,
      subtotal, discount_amount, cgst_total, sgst_total, igst_total,
      total_tax, grand_total, status, notes, terms, items
    } = req.body;

    const transaction = db.transaction(() => {
      // Delete old items
      db.prepare('DELETE FROM po_items WHERE po_id = ?').run(req.params.id);

      // Update PO
      db.prepare(`
        UPDATE purchase_orders SET
          po_date = ?, expected_date = ?, supplier_id = ?,
          subtotal = ?, discount_amount = ?,
          cgst_total = ?, sgst_total = ?, igst_total = ?,
          total_tax = ?, grand_total = ?, status = ?,
          notes = ?, terms = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        po_date || existing.po_date, expected_date || '', supplier_id || existing.supplier_id,
        subtotal || 0, discount_amount || 0, cgst_total || 0, sgst_total || 0,
        igst_total || 0, total_tax || 0, grand_total || 0, status || existing.status,
        notes || '', terms || '',
        req.params.id
      );

      // Insert new items
      if (items && items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO po_items (
            po_id, product_id, description, hsn_sac, quantity, unit, rate,
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

    const po = db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
    `).get(req.params.id);

    const updatedItems = db.prepare('SELECT * FROM po_items WHERE po_id = ?').all(req.params.id);

    res.json({ ...po, items: updatedItems });
  } catch (err) {
    console.error('Error updating purchase order:', err.message);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// DELETE /api/purchase-orders/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(req.params.id);
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (err) {
    console.error('Error deleting purchase order:', err.message);
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

export default router;
