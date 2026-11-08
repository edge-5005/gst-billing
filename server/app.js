import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import companyRoutes from './routes/company.js';
import customerRoutes from './routes/customers.js';
import supplierRoutes from './routes/suppliers.js';
import productRoutes from './routes/products.js';
import invoiceRoutes from './routes/invoices.js';
import quotationRoutes from './routes/quotations.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import paymentRoutes from './routes/payments.js';
import reportRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount API routes
app.use('/api/company', companyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files if built (useful for standalone local production server)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export default app;
