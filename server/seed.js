import db from './db.js';

console.log('Seeding demo data...');

// Check if data already seeded
const custCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();
if (custCount.count > 0) {
  console.log('Database already has customer records, skipping seed.');
  process.exit(0);
}

// 1. Company profile update
db.prepare(`
  UPDATE company SET
    name = 'Apex Infotech Solutions Pvt Ltd',
    gstin = '33AABCA1234F1Z9',
    pan = 'AABCA1234F',
    address = 'Suite 402, Technology Towers, Guindy',
    city = 'Chennai',
    state = 'Tamil Nadu',
    state_code = '33',
    pincode = '600032',
    phone = '+91 94441 23456',
    email = 'accounts@apexinfotech.in',
    bank_name = 'HDFC Bank',
    bank_account = '50200012345678',
    bank_ifsc = 'HDFC0001234',
    bank_branch = 'Guindy Industrial Estate',
    invoice_prefix = 'INV-2026'
  WHERE id = 1
`).run();

// 2. Customers
const insertCustomer = db.prepare(`
  INSERT INTO customers (
    name, gstin, pan, phone, email,
    billing_address, billing_city, billing_state, billing_state_code, billing_pincode,
    shipping_address, shipping_city, shipping_state, shipping_state_code, shipping_pincode
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const c1 = insertCustomer.run(
  'Sri Murugan Enterprises', '33AABCS8899M1Z2', 'AABCS8899M', '9840112233', 'murugan@srient.com',
  '45 Mount Road', 'Chennai', 'Tamil Nadu', '33', '600002',
  '45 Mount Road', 'Chennai', 'Tamil Nadu', '33', '600002'
).lastInsertRowid;

const c2 = insertCustomer.run(
  'Zenith Systems & Logistics', '29AAACZ7788L1Z6', 'AAACZ7788L', '9880199887', 'billing@zenithsys.com',
  '120 Koramangala 4th Block', 'Bengaluru', 'Karnataka', '29', '560034',
  '120 Koramangala 4th Block', 'Bengaluru', 'Karnataka', '29', '560034'
).lastInsertRowid;

const c3 = insertCustomer.run(
  'Kaveri Retailers (Consumer)', '', '', '9710554433', 'kaveri.chennai@gmail.com',
  '88 T. Nagar Bazaar Street', 'Chennai', 'Tamil Nadu', '33', '600017',
  '88 T. Nagar Bazaar Street', 'Chennai', 'Tamil Nadu', '33', '600017'
).lastInsertRowid;

const c4 = insertCustomer.run(
  'Maruti Trading Co', '27AABCM6655P1ZK', 'AABCM6655P', '9820334455', 'accounts@marutitrading.co.in',
  '204 Nariman Point', 'Mumbai', 'Maharashtra', '27', '400021',
  '204 Nariman Point', 'Mumbai', 'Maharashtra', '27', '400021'
).lastInsertRowid;

// 3. Suppliers
const insertSupplier = db.prepare(`
  INSERT INTO suppliers (name, gstin, pan, phone, email, address, city, state, state_code, pincode)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const s1 = insertSupplier.run(
  'Supreme Components Hub', '33AABCS1122K1Z4', 'AABCS1122K', '9840998811', 'sales@supremecomp.in',
  '14 Ritchie Street', 'Chennai', 'Tamil Nadu', '33', '600002'
).lastInsertRowid;

const s2 = insertSupplier.run(
  'Vanguard Technology Distributors', '29AAACV4455Q1Z9', 'AAACV4455Q', '9880556677', 'orders@vanguardtech.com',
  '78 Electronics City Phase 1', 'Bengaluru', 'Karnataka', '29', '560100'
).lastInsertRowid;

// 4. Products & Services
const insertProduct = db.prepare(`
  INSERT INTO products (name, hsn_sac, unit, type, sale_price, purchase_price, gst_rate, stock_qty)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const p1 = insertProduct.run('Dell UltraSharp 27" 4K Monitor', '8471', 'NOS', 'goods', 38500, 31000, 18, 25).lastInsertRowid;
const p2 = insertProduct.run('Logitech MX Master 3S Wireless Mouse', '8471', 'NOS', 'goods', 8999, 7200, 18, 50).lastInsertRowid;
const p3 = insertProduct.run('Mechanical Gaming Keyboard RGB', '8471', 'NOS', 'goods', 4500, 3200, 18, 40).lastInsertRowid;
const p4 = insertProduct.run('Cat6 Shielded High-Speed Ethernet Cable 100m', '8544', 'BOX', 'goods', 3200, 2400, 18, 100).lastInsertRowid;
const p5 = insertProduct.run('Enterprise Cloud ERP Implementation & Setup', '998313', 'HRS', 'services', 50000, 0, 18, 0).lastInsertRowid;
const p6 = insertProduct.run('Annual IT Infrastructure Maintenance Contract (AMC)', '9987', 'SET', 'services', 75000, 0, 18, 0).lastInsertRowid;

// 5. Invoices
// Invoice 1: Intra-state B2B to Sri Murugan Enterprises (CGST + SGST)
const inv1 = db.prepare(`
  INSERT INTO invoices (
    invoice_number, invoice_date, due_date, customer_id, invoice_type,
    place_of_supply, place_of_supply_code, is_reverse_charge,
    subtotal, discount_amount, cgst_total, sgst_total, igst_total,
    total_tax, grand_total, amount_paid, status, notes, terms
  ) VALUES (
    'INV-2026-0001', '2026-10-10', '2026-10-25', ?, 'tax_invoice',
    'Tamil Nadu', '33', 0,
    85999, 0, 7739.91, 7739.91, 0,
    15479.82, 101478.82, 101478.82, 'paid',
    'Thank you for your business!', 'Payment received via NEFT.'
  )
`).run(c1).lastInsertRowid;

db.prepare(`
  INSERT INTO invoice_items (
    invoice_id, product_id, description, hsn_sac, quantity, unit, rate,
    discount_percent, discount_amount, taxable_amount, gst_rate,
    cgst_amount, sgst_amount, igst_amount, total
  ) VALUES
  (?, ?, 'Dell UltraSharp 27" 4K Monitor', '8471', 2, 'NOS', 38500, 0, 0, 77000, 18, 6930, 6930, 0, 90860),
  (?, ?, 'Logitech MX Master 3S Wireless Mouse', '8471', 1, 'NOS', 8999, 0, 0, 8999, 18, 809.91, 809.91, 0, 10618.82)
`).run(inv1, p1, inv1, p2);

db.prepare(`
  INSERT INTO payments (invoice_id, payment_date, amount, payment_mode, reference_number, notes)
  VALUES (?, '2026-10-15', 101478.82, 'bank_transfer', 'HDFCN2610158912', 'Full payment received')
`).run(inv1);

// Invoice 2: Inter-state B2B to Zenith Systems (IGST)
const inv2 = db.prepare(`
  INSERT INTO invoices (
    invoice_number, invoice_date, due_date, customer_id, invoice_type,
    place_of_supply, place_of_supply_code, is_reverse_charge,
    subtotal, discount_amount, cgst_total, sgst_total, igst_total,
    total_tax, grand_total, amount_paid, status, notes, terms
  ) VALUES (
    'INV-2026-0002', '2026-10-18', '2026-11-02', ?, 'tax_invoice',
    'Karnataka', '29', 0,
    125000, 0, 0, 0, 22500,
    22500, 147500, 50000, 'partial',
    'Goods dispatched via Blue Dart AWB#99881122', '30 days credit terms.'
  )
`).run(c2).lastInsertRowid;

db.prepare(`
  INSERT INTO invoice_items (
    invoice_id, product_id, description, hsn_sac, quantity, unit, rate,
    discount_percent, discount_amount, taxable_amount, gst_rate,
    cgst_amount, sgst_amount, igst_amount, total
  ) VALUES
  (?, ?, 'Enterprise Cloud ERP Implementation & Setup', '998313', 1, 'HRS', 50000, 0, 0, 50000, 18, 0, 0, 9000, 59000),
  (?, ?, 'Annual IT Infrastructure Maintenance Contract (AMC)', '9987', 1, 'SET', 75000, 0, 0, 75000, 18, 0, 0, 13500, 88500)
`).run(inv2, p5, inv2, p6);

db.prepare(`
  INSERT INTO payments (invoice_id, payment_date, amount, payment_mode, reference_number, notes)
  VALUES (?, '2026-10-20', 50000, 'upi', 'UPI/261020/009123', 'Part payment received via UPI')
`).run(inv2);

// Invoice 3: Intra-state B2C to Kaveri Retailers
const inv3 = db.prepare(`
  INSERT INTO invoices (
    invoice_number, invoice_date, due_date, customer_id, invoice_type,
    place_of_supply, place_of_supply_code, is_reverse_charge,
    subtotal, discount_amount, cgst_total, sgst_total, igst_total,
    total_tax, grand_total, amount_paid, status, notes, terms
  ) VALUES (
    'INV-2026-0003', '2026-10-22', '2026-10-22', ?, 'tax_invoice',
    'Tamil Nadu', '33', 0,
    13700, 0, 1233, 1233, 0,
    2466, 16166, 0, 'unpaid',
    'Counter sales', 'Cash on delivery.'
  )
`).run(c3).lastInsertRowid;

db.prepare(`
  INSERT INTO invoice_items (
    invoice_id, product_id, description, hsn_sac, quantity, unit, rate,
    discount_percent, discount_amount, taxable_amount, gst_rate,
    cgst_amount, sgst_amount, igst_amount, total
  ) VALUES
  (?, ?, 'Mechanical Gaming Keyboard RGB', '8471', 1, 'NOS', 4500, 0, 0, 4500, 18, 405, 405, 0, 5310),
  (?, ?, 'Cat6 Shielded High-Speed Ethernet Cable 100m', '8544', 2, 'BOX', 3200, 0, 0, 6400, 18, 576, 576, 0, 7552),
  (?, ?, 'Logitech MX Master 3S Wireless Mouse', '8471', 0.31, 'NOS', 8999, 0, 0, 2800, 18, 252, 252, 0, 3304)
`).run(inv3, p3, inv3, p4, inv3, p2);

// 6. Quotation for Maruti Trading Co
const q1 = db.prepare(`
  INSERT INTO quotations (
    quotation_number, quotation_date, valid_until, customer_id,
    subtotal, discount_amount, cgst_total, sgst_total, igst_total,
    total_tax, grand_total, status, notes, terms
  ) VALUES (
    'QTN-2026-0001', '2026-10-21', '2026-11-20', ?,
    192500, 0, 0, 0, 34650,
    34650, 227150, 'sent',
    'Quotation for office IT upgrade', 'Valid for 30 days.'
  )
`).run(c4).lastInsertRowid;

db.prepare(`
  INSERT INTO quotation_items (
    quotation_id, product_id, description, hsn_sac, quantity, unit, rate,
    discount_percent, discount_amount, taxable_amount, gst_rate,
    cgst_amount, sgst_amount, igst_amount, total
  ) VALUES (?, ?, 'Dell UltraSharp 27" 4K Monitor', '8471', 5, 'NOS', 38500, 0, 0, 192500, 18, 0, 0, 34650, 227150)
`).run(q1, p1);

// 7. Purchase Order to Supreme Components
const po1 = db.prepare(`
  INSERT INTO purchase_orders (
    po_number, po_date, expected_date, supplier_id,
    subtotal, discount_amount, cgst_total, sgst_total, igst_total,
    total_tax, grand_total, status, notes, terms
  ) VALUES (
    'PO-2026-0001', '2026-10-05', '2026-10-12', ?,
    155000, 0, 13950, 13950, 0,
    27900, 182900, 'received',
    'Stock replenishment', 'Standard vendor payment terms.'
  )
`).run(s1).lastInsertRowid;

db.prepare(`
  INSERT INTO po_items (
    po_id, product_id, description, hsn_sac, quantity, unit, rate,
    discount_percent, discount_amount, taxable_amount, gst_rate,
    cgst_amount, sgst_amount, igst_amount, total
  ) VALUES (?, ?, 'Dell UltraSharp 27" 4K Monitor', '8471', 5, 'NOS', 31000, 0, 0, 155000, 18, 13950, 13950, 0, 182900)
`).run(po1, p1);

console.log('Demo data seeded successfully!');
