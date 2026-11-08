# GST Billing Software

A complete, professional GST invoicing and billing software built for Indian businesses with **React**, **Node.js/Express**, and **SQLite**.

---

## 🚀 Quick Start (How to Run)

### Method 1: One-Click Run (Windows)
Double-click the **`start.bat`** file located in the project folder:
```
c:\Users\Muthuraja Rajasekar\Documents\Projects\gst-billing\start.bat
```
This automatically launches the application and opens `http://localhost:5000` in your default browser.

---

### Method 2: Command Line (PowerShell / Terminal)

Open PowerShell or Command Prompt in the project folder:

```powershell
cd "c:\Users\Muthuraja Rajasekar\Documents\Projects\gst-billing"
```

#### Run Production Server (Instant Access):
```powershell
npm run server
```
Then open: **[http://localhost:5000](http://localhost:5000)**

#### Run in Development Mode (Live Reloading / HMR):
```powershell
npm run dev
```
Then open: **[http://localhost:3000](http://localhost:3000)**

---

## 🌟 Key Features

### 1. Invoicing & Document Types
- **Tax Invoice**: Auto-calculates CGST + SGST for intra-state or IGST for inter-state supply based on GST state codes.
- **Bill of Supply**: For composition scheme or exempt goods with zero tax breakdown.
- **Credit Note & Debit Note**: Reference original tax invoices with reason tracking.
- **Quotations / Estimates**: Easily generate estimates and convert them into Tax Invoices with one click.
- **Purchase Orders**: Manage vendor orders and stock replenishment.

### 2. PDF & Printing
- Professional GST-compliant A4 PDF generation using **pdfmake**.
- Includes company header, customer billing & shipping addresses, HSN/SAC breakdown, tax rates, total in words, bank details, and signature area.
- Direct browser print support (`Ctrl + P`).

### 3. Master Data Management
- **Customers**: Billing and shipping address, GSTIN, State code, contact info.
- **Suppliers**: Vendor database with GSTIN and location details.
- **Products & Services**: HSN/SAC codes, Units (PCS, KG, LTR, etc.), GST tax slabs (0%, 5%, 12%, 18%, 28%), stock quantities.

### 4. Payments & Reconciliations
- Record customer payments against invoices (Bank Transfer, UPI, Cash, Cheque, Card).
- Auto-updates invoice status: `Unpaid`, `Partial`, or `Paid`.
- Real-time balance due calculations.

### 5. Official GST Reports & Filing Assistance
- **GSTR-1 Summary**: Outward supplies categorized by tax rate, Table 4 (B2B), Table 5/7 (B2C), and Table 9B (Credit/Debit Notes) with CSV export.
- **GSTR-3B Summary**: Section 3.1 outward taxable value, Table 4 Eligible ITC (from purchase orders), and Net Tax Liability calculations with CSV export.
- **HSN/SAC Wise Summary**: Table 12 HSN sales report with quantities and tax values with CSV export.

### 6. Interactive Dashboard
- Total Sales, Outstanding Receivables, Invoice counts.
- Monthly revenue trends bar chart.
- Top 5 customers by revenue.
- GST liability overview for the current tax period.

---

## 🗄️ Database & Demo Data

The database uses SQLite (`server/data/gst-billing.sqlite`). Pre-loaded demo data includes:
- **Company**: Apex Infotech Solutions Pvt Ltd (Tamil Nadu - State 33)
- **Sample Customers**: Intra-state and Inter-state B2B & B2C accounts
- **Sample Products**: Hardware monitors, mice, cables, and IT services
- **Sample Invoices & Payments**: Ready for testing and report generation

To reset or re-seed demo data at any time:
```powershell
node server/seed.js
```
