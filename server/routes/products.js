import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/products — list all (with search, filter by type)
router.get('/', (req, res) => {
  try {
    const { search, type } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR hsn_sac LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (type && (type === 'goods' || type === 'services')) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY name ASC';
    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id — get one
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products — create
router.post('/', (req, res) => {
  try {
    const { name, hsn_sac, unit, type, sale_price, purchase_price, gst_rate, stock_qty } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO products (name, hsn_sac, unit, type, sale_price, purchase_price, gst_rate, stock_qty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      hsn_sac || '',
      unit || 'PCS',
      type || 'goods',
      sale_price || 0,
      purchase_price || 0,
      gst_rate != null ? gst_rate : 18,
      stock_qty || 0
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (err) {
    console.error('Error creating product:', err.message);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id — update
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { name, hsn_sac, unit, type, sale_price, purchase_price, gst_rate, stock_qty } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const stmt = db.prepare(`
      UPDATE products SET
        name = ?, hsn_sac = ?, unit = ?, type = ?,
        sale_price = ?, purchase_price = ?, gst_rate = ?, stock_qty = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      name.trim(),
      hsn_sac || '',
      unit || 'PCS',
      type || 'goods',
      sale_price || 0,
      purchase_price || 0,
      gst_rate != null ? gst_rate : 18,
      stock_qty != null ? stock_qty : existing.stock_qty,
      req.params.id
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (err) {
    console.error('Error updating product:', err.message);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id — delete (check for usage first)
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const invoiceCheck = db.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE product_id = ?').get(req.params.id);
    if (invoiceCheck.count > 0) {
      return res.status(400).json({ error: `Cannot delete product. It is used in ${invoiceCheck.count} invoice item(s).` });
    }

    const quotationCheck = db.prepare('SELECT COUNT(*) as count FROM quotation_items WHERE product_id = ?').get(req.params.id);
    if (quotationCheck.count > 0) {
      return res.status(400).json({ error: `Cannot delete product. It is used in ${quotationCheck.count} quotation item(s).` });
    }

    const poCheck = db.prepare('SELECT COUNT(*) as count FROM po_items WHERE product_id = ?').get(req.params.id);
    if (poCheck.count > 0) {
      return res.status(400).json({ error: `Cannot delete product. It is used in ${poCheck.count} purchase order item(s).` });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err.message);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
