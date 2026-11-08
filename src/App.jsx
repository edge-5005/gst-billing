import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CompanyProfile from './pages/CompanyProfile';
import CustomerList from './pages/CustomerList';
import CustomerForm from './pages/CustomerForm';
import SupplierList from './pages/SupplierList';
import SupplierForm from './pages/SupplierForm';
import ProductList from './pages/ProductList';
import ProductForm from './pages/ProductForm';
import InvoiceList from './pages/InvoiceList';
import InvoiceForm from './pages/InvoiceForm';
import InvoiceView from './pages/InvoiceView';
import QuotationList from './pages/QuotationList';
import QuotationForm from './pages/QuotationForm';
import QuotationView from './pages/QuotationView';
import PurchaseOrderList from './pages/PurchaseOrderList';
import PurchaseOrderForm from './pages/PurchaseOrderForm';
import PurchaseOrderView from './pages/PurchaseOrderView';
import PaymentList from './pages/PaymentList';
import GSTR1Report from './pages/GSTR1Report';
import GSTR3BReport from './pages/GSTR3BReport';
import HSNReport from './pages/HSNReport';

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* Company Profile */}
        <Route path="/company" element={<CompanyProfile />} />

        {/* Customers */}
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/customers/new" element={<CustomerForm />} />
        <Route path="/customers/:id/edit" element={<CustomerForm />} />

        {/* Suppliers */}
        <Route path="/suppliers" element={<SupplierList />} />
        <Route path="/suppliers/new" element={<SupplierForm />} />
        <Route path="/suppliers/:id/edit" element={<SupplierForm />} />

        {/* Products */}
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id/edit" element={<ProductForm />} />

        {/* Invoices */}
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/new" element={<InvoiceForm type="tax_invoice" />} />
        <Route path="/invoices/:id" element={<InvoiceView />} />
        <Route path="/invoices/:id/edit" element={<InvoiceForm />} />

        {/* Bill of Supply, Credit Note, Debit Note */}
        <Route path="/bill-of-supply/new" element={<InvoiceForm type="bill_of_supply" />} />
        <Route path="/credit-notes/new" element={<InvoiceForm type="credit_note" />} />
        <Route path="/debit-notes/new" element={<InvoiceForm type="debit_note" />} />

        {/* Quotations */}
        <Route path="/quotations" element={<QuotationList />} />
        <Route path="/quotations/new" element={<QuotationForm />} />
        <Route path="/quotations/:id" element={<QuotationView />} />
        <Route path="/quotations/:id/edit" element={<QuotationForm />} />

        {/* Purchase Orders */}
        <Route path="/purchase-orders" element={<PurchaseOrderList />} />
        <Route path="/purchase-orders/new" element={<PurchaseOrderForm />} />
        <Route path="/purchase-orders/:id" element={<PurchaseOrderView />} />
        <Route path="/purchase-orders/:id/edit" element={<PurchaseOrderForm />} />

        {/* Payments */}
        <Route path="/payments" element={<PaymentList />} />

        {/* Reports */}
        <Route path="/reports/gstr1" element={<GSTR1Report />} />
        <Route path="/reports/gstr3b" element={<GSTR3BReport />} />
        <Route path="/reports/hsn" element={<HSNReport />} />
      </Routes>
    </Layout>
  );
}
