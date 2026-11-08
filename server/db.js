import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Candidate paths for sql-wasm.wasm
const possibleWasmPaths = [
  path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  path.resolve('/var/task', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
];

let wasmBinary = null;
for (const p of possibleWasmPaths) {
  if (fs.existsSync(p)) {
    try {
      wasmBinary = fs.readFileSync(p);
      break;
    } catch (e) {
      // try next
    }
  }
}

// Candidate paths for bundled database
const possibleBundledPaths = [
  path.join(__dirname, 'data', 'gst-billing.sqlite'),
  path.join(process.cwd(), 'server', 'data', 'gst-billing.sqlite'),
  path.join('/var/task', 'server', 'data', 'gst-billing.sqlite'),
];

let bundledDbPath = null;
for (const p of possibleBundledPaths) {
  if (fs.existsSync(p)) {
    bundledDbPath = p;
    break;
  }
}

const dataDir = isVercel ? '/tmp' : path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'gst-billing.sqlite');

if (!isVercel && !fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create data dir:', err);
  }
}

// In Vercel serverless environment, copy the pre-seeded SQLite DB into /tmp
if (isVercel && !fs.existsSync(dbPath) && bundledDbPath) {
  try {
    fs.copyFileSync(bundledDbPath, dbPath);
  } catch (err) {
    console.error('Failed to copy bundled db to /tmp:', err);
  }
}

// Initialize sql.js using pre-loaded wasm binary if available
const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : {});

let rawDb;
if (fs.existsSync(dbPath)) {
  try {
    const fileBuffer = fs.readFileSync(dbPath);
    rawDb = new SQL.Database(fileBuffer);
  } catch (e) {
    rawDb = new SQL.Database();
  }
} else if (bundledDbPath) {
  try {
    const fileBuffer = fs.readFileSync(bundledDbPath);
    rawDb = new SQL.Database(fileBuffer);
  } catch (e) {
    rawDb = new SQL.Database();
  }
} else {
  rawDb = new SQL.Database();
}

let saveDebounceTimer = null;
function saveImmediately() {
  try {
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.warn('Could not persist sqlite to disk (ignoring in serverless):', err.message);
  }
}

function scheduleSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(saveImmediately, 100);
}

function normalizeParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0].map((v) => (v === undefined ? null : v));
  }
  return args.map((v) => (v === undefined ? null : v));
}

class StatementWrapper {
  constructor(sql) {
    this.sql = sql;
  }

  get(...args) {
    const params = normalizeParams(args);
    const stmt = rawDb.prepare(this.sql);
    try {
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all(...args) {
    const params = normalizeParams(args);
    const stmt = rawDb.prepare(this.sql);
    const rows = [];
    try {
      if (params.length > 0) stmt.bind(params);
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  run(...args) {
    const params = normalizeParams(args);
    const stmt = rawDb.prepare(this.sql);
    try {
      if (params.length > 0) stmt.bind(params);
      stmt.step();
      const changes = rawDb.getRowsModified();
      const rowIdRes = rawDb.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid =
        rowIdRes.length > 0 && rowIdRes[0].values.length > 0
          ? rowIdRes[0].values[0][0]
          : 0;

      scheduleSave();
      return { changes, lastInsertRowid };
    } finally {
      stmt.free();
    }
  }
}

const db = {
  prepare(sql) {
    return new StatementWrapper(sql);
  },

  exec(sql) {
    rawDb.exec(sql);
    saveImmediately();
  },

  pragma(pragmaStr) {
    try {
      rawDb.exec(`PRAGMA ${pragmaStr}`);
    } catch (e) {
      // ignore in sql.js
    }
  },

  transaction(fn) {
    return (...args) => {
      rawDb.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        saveImmediately();
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK');
        throw err;
      }
    };
  },
};

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS company (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    gstin TEXT DEFAULT '',
    pan TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',
    state_code TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    bank_account TEXT DEFAULT '',
    bank_ifsc TEXT DEFAULT '',
    bank_branch TEXT DEFAULT '',
    invoice_prefix TEXT DEFAULT 'INV',
    logo_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gstin TEXT DEFAULT '',
    pan TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    billing_address TEXT DEFAULT '',
    billing_city TEXT DEFAULT '',
    billing_state TEXT DEFAULT '',
    billing_state_code TEXT DEFAULT '',
    billing_pincode TEXT DEFAULT '',
    shipping_address TEXT DEFAULT '',
    shipping_city TEXT DEFAULT '',
    shipping_state TEXT DEFAULT '',
    shipping_state_code TEXT DEFAULT '',
    shipping_pincode TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gstin TEXT DEFAULT '',
    pan TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',
    state_code TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hsn_sac TEXT DEFAULT '',
    unit TEXT DEFAULT 'PCS',
    type TEXT DEFAULT 'goods',
    sale_price REAL DEFAULT 0,
    purchase_price REAL DEFAULT 0,
    gst_rate REAL DEFAULT 18,
    stock_qty INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date TEXT NOT NULL,
    due_date TEXT,
    customer_id INTEGER REFERENCES customers(id),
    invoice_type TEXT DEFAULT 'tax_invoice',
    reference_invoice_id INTEGER,
    place_of_supply TEXT DEFAULT '',
    place_of_supply_code TEXT DEFAULT '',
    is_reverse_charge INTEGER DEFAULT 0,
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    cgst_total REAL DEFAULT 0,
    sgst_total REAL DEFAULT 0,
    igst_total REAL DEFAULT 0,
    total_tax REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    notes TEXT DEFAULT '',
    terms TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description TEXT DEFAULT '',
    hsn_sac TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'PCS',
    rate REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    taxable_amount REAL DEFAULT 0,
    gst_rate REAL DEFAULT 0,
    cgst_amount REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    total REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_number TEXT UNIQUE NOT NULL,
    quotation_date TEXT NOT NULL,
    valid_until TEXT,
    customer_id INTEGER REFERENCES customers(id),
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    cgst_total REAL DEFAULT 0,
    sgst_total REAL DEFAULT 0,
    igst_total REAL DEFAULT 0,
    total_tax REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    notes TEXT DEFAULT '',
    terms TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quotation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description TEXT DEFAULT '',
    hsn_sac TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'PCS',
    rate REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    taxable_amount REAL DEFAULT 0,
    gst_rate REAL DEFAULT 0,
    cgst_amount REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    total REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT UNIQUE NOT NULL,
    po_date TEXT NOT NULL,
    expected_date TEXT,
    supplier_id INTEGER REFERENCES suppliers(id),
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    cgst_total REAL DEFAULT 0,
    sgst_total REAL DEFAULT 0,
    igst_total REAL DEFAULT 0,
    total_tax REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    notes TEXT DEFAULT '',
    terms TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS po_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description TEXT DEFAULT '',
    hsn_sac TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'PCS',
    rate REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    taxable_amount REAL DEFAULT 0,
    gst_rate REAL DEFAULT 0,
    cgst_amount REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    total REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER REFERENCES invoices(id),
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT DEFAULT 'cash',
    reference_number TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Insert default company profile if not exists
const companyCount = db.prepare('SELECT COUNT(*) as count FROM company').get();
if (!companyCount || companyCount.count === 0) {
  db.prepare(`
    INSERT INTO company (name, gstin, pan, address, city, state, state_code, pincode, phone, email, invoice_prefix)
    VALUES ('Acme Solutions Pvt Ltd', '33AAACA1234A1Z5', 'AAACA1234A', '123 Anna Salai', 'Chennai', 'Tamil Nadu', '33', '600002', '+91 9876543210', 'info@acmesolutions.com', 'INV')
  `).run();
}

export default db;
