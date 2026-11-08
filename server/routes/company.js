import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/company — get company info
router.get('/', (req, res) => {
  try {
    const company = db.prepare('SELECT * FROM company WHERE id = 1').get();
    if (!company) {
      return res.status(404).json({ error: 'Company info not found' });
    }
    res.json(company);
  } catch (err) {
    console.error('Error fetching company:', err.message);
    res.status(500).json({ error: 'Failed to fetch company info' });
  }
});

// PUT /api/company — update company info
router.put('/', (req, res) => {
  try {
    const {
      name, gstin, pan, address, city, state, state_code, pincode,
      phone, email, bank_name, bank_account, bank_ifsc, bank_branch,
      invoice_prefix, logo_url
    } = req.body;

    const stmt = db.prepare(`
      UPDATE company SET
        name = COALESCE(?, name),
        gstin = COALESCE(?, gstin),
        pan = COALESCE(?, pan),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        state_code = COALESCE(?, state_code),
        pincode = COALESCE(?, pincode),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        bank_name = COALESCE(?, bank_name),
        bank_account = COALESCE(?, bank_account),
        bank_ifsc = COALESCE(?, bank_ifsc),
        bank_branch = COALESCE(?, bank_branch),
        invoice_prefix = COALESCE(?, invoice_prefix),
        logo_url = COALESCE(?, logo_url),
        updated_at = datetime('now')
      WHERE id = 1
    `);

    stmt.run(
      name, gstin, pan, address, city, state, state_code, pincode,
      phone, email, bank_name, bank_account, bank_ifsc, bank_branch,
      invoice_prefix, logo_url
    );

    const company = db.prepare('SELECT * FROM company WHERE id = 1').get();
    res.json(company);
  } catch (err) {
    console.error('Error updating company:', err.message);
    res.status(500).json({ error: 'Failed to update company info' });
  }
});

export default router;
