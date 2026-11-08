import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { formatCurrency, formatDate, numberToWords } from '../utils/helpers';
import { INVOICE_TYPES } from '../utils/constants';

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

/**
 * Color palette for the PDF
 */
const COLORS = {
  primary: '#1a237e',
  secondary: '#283593',
  accent: '#3949ab',
  headerBg: '#e8eaf6',
  rowAlt: '#f5f5f5',
  border: '#bdbdbd',
  lightBorder: '#e0e0e0',
  text: '#212121',
  textSecondary: '#616161',
  white: '#ffffff',
  watermark: '#f0f0f0',
};

/**
 * Format amount for PDF display (₹ symbol with Indian formatting).
 */
function pdfAmount(amount) {
  return formatCurrency(amount);
}

/**
 * Get the state name with code from a GSTIN or state code.
 */
function getStateFromCode(stateCode) {
  const codes = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
    '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
    '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
    '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
    '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
    '36': 'Telangana', '37': 'Andhra Pradesh (New)', '38': 'Ladakh',
  };
  const code = String(stateCode).padStart(2, '0');
  const name = codes[code];
  return name ? `${name} (${code})` : code;
}

/**
 * Determine if the invoice is inter-state.
 */
function isInterState(invoice) {
  const companyState = invoice.company_state_code || '';
  const placeOfSupply = invoice.place_of_supply || invoice.customer_state_code || '';
  return String(companyState).padStart(2, '0') !== String(placeOfSupply).padStart(2, '0');
}

/**
 * Check if the invoice type is a bill of supply.
 */
function isBillOfSupply(invoice) {
  return invoice.invoice_type === 'bill_of_supply';
}

/**
 * Build the header section of the invoice PDF.
 */
function buildHeader(company) {
  const companyDetails = [];
  const addressParts = [];

  if (company.address) addressParts.push(company.address);
  if (company.city) addressParts.push(company.city);
  if (company.state) addressParts.push(company.state);
  if (company.pincode) addressParts.push(`- ${company.pincode}`);

  if (addressParts.length > 0) {
    companyDetails.push({ text: addressParts.join(', '), fontSize: 9, color: COLORS.textSecondary, margin: [0, 2, 0, 0] });
  }

  const infoParts = [];
  if (company.gstin) infoParts.push(`GSTIN: ${company.gstin}`);
  if (company.pan) infoParts.push(`PAN: ${company.pan}`);
  if (company.phone) infoParts.push(`Phone: ${company.phone}`);
  if (company.email) infoParts.push(`Email: ${company.email}`);

  if (infoParts.length > 0) {
    companyDetails.push({ text: infoParts.join('  |  '), fontSize: 8, color: COLORS.textSecondary, margin: [0, 3, 0, 0] });
  }

  return {
    stack: [
      { text: company.name || 'Company Name', fontSize: 18, bold: true, color: COLORS.primary, alignment: 'center' },
      ...companyDetails.map(d => ({ ...d, alignment: 'center' })),
    ],
    margin: [0, 0, 0, 10],
  };
}

/**
 * Build the invoice title section.
 */
function buildTitle(invoice) {
  const typeName = INVOICE_TYPES[invoice.invoice_type] || 'TAX INVOICE';
  return [
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: COLORS.border }], margin: [0, 5, 0, 5] },
    { text: typeName.toUpperCase(), fontSize: 14, bold: true, alignment: 'center', color: COLORS.primary, margin: [0, 0, 0, 5] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: COLORS.lightBorder }], margin: [0, 0, 0, 10] },
  ];
}

/**
 * Build Bill To / Ship To and Invoice Details two-column section.
 */
function buildPartyAndInvoiceDetails(invoice) {
  // Left column: Bill To
  const billToStack = [
    { text: 'Bill To:', fontSize: 10, bold: true, color: COLORS.primary, margin: [0, 0, 0, 4] },
    { text: invoice.customer_name || '', fontSize: 10, bold: true },
  ];

  if (invoice.customer_gstin) {
    billToStack.push({ text: `GSTIN: ${invoice.customer_gstin}`, fontSize: 8, color: COLORS.textSecondary, margin: [0, 2, 0, 0] });
  }

  const billingAddress = [];
  if (invoice.billing_address) billingAddress.push(invoice.billing_address);
  const cityStateParts = [];
  if (invoice.billing_city) cityStateParts.push(invoice.billing_city);
  if (invoice.billing_state) cityStateParts.push(invoice.billing_state);
  if (invoice.billing_pincode) cityStateParts.push(`- ${invoice.billing_pincode}`);
  if (cityStateParts.length > 0) billingAddress.push(cityStateParts.join(', '));

  billingAddress.forEach(line => {
    billToStack.push({ text: line, fontSize: 9, color: COLORS.textSecondary, margin: [0, 1, 0, 0] });
  });

  // Ship To section (if different from billing)
  const hasShipping = invoice.shipping_address && invoice.shipping_address !== invoice.billing_address;
  if (hasShipping) {
    billToStack.push({ text: '', margin: [0, 6, 0, 0] });
    billToStack.push({ text: 'Ship To:', fontSize: 10, bold: true, color: COLORS.primary, margin: [0, 0, 0, 4] });
    if (invoice.shipping_address) {
      billToStack.push({ text: invoice.shipping_address, fontSize: 9, color: COLORS.textSecondary, margin: [0, 1, 0, 0] });
    }
    const shipCityState = [];
    if (invoice.shipping_city) shipCityState.push(invoice.shipping_city);
    if (invoice.shipping_state) shipCityState.push(invoice.shipping_state);
    if (invoice.shipping_pincode) shipCityState.push(`- ${invoice.shipping_pincode}`);
    if (shipCityState.length > 0) {
      billToStack.push({ text: shipCityState.join(', '), fontSize: 9, color: COLORS.textSecondary, margin: [0, 1, 0, 0] });
    }
  }

  // Right column: Invoice Details
  const invoiceDetailsRows = [
    ['Invoice No:', invoice.invoice_number || ''],
    ['Invoice Date:', formatDate(invoice.invoice_date)],
  ];

  if (invoice.due_date) {
    invoiceDetailsRows.push(['Due Date:', formatDate(invoice.due_date)]);
  }

  const placeOfSupplyCode = invoice.place_of_supply || invoice.customer_state_code || '';
  if (placeOfSupplyCode) {
    invoiceDetailsRows.push(['Place of Supply:', getStateFromCode(placeOfSupplyCode)]);
  }

  invoiceDetailsRows.push(['Reverse Charge:', invoice.reverse_charge ? 'Yes' : 'No']);

  if (invoice.invoice_type === 'credit_note' || invoice.invoice_type === 'debit_note') {
    if (invoice.original_invoice_number) {
      invoiceDetailsRows.push(['Original Invoice:', invoice.original_invoice_number]);
    }
    if (invoice.original_invoice_date) {
      invoiceDetailsRows.push(['Original Date:', formatDate(invoice.original_invoice_date)]);
    }
    if (invoice.reason) {
      invoiceDetailsRows.push(['Reason:', invoice.reason]);
    }
  }

  const detailsBody = invoiceDetailsRows.map(([label, value]) => [
    { text: label, fontSize: 9, bold: true, color: COLORS.textSecondary },
    { text: value, fontSize: 9 },
  ]);

  const rightColumn = {
    stack: [
      { text: 'Invoice Details:', fontSize: 10, bold: true, color: COLORS.primary, margin: [0, 0, 0, 4] },
      {
        table: {
          widths: ['auto', '*'],
          body: detailsBody,
        },
        layout: 'noBorders',
      },
    ],
  };

  return {
    columns: [
      { stack: billToStack, width: '50%' },
      { stack: [rightColumn], width: '50%' },
    ],
    margin: [0, 0, 0, 15],
  };
}

/**
 * Build the items table.
 */
function buildItemsTable(invoice) {
  const items = invoice.items || [];
  const interState = isInterState(invoice);
  const billOfSupply = isBillOfSupply(invoice);

  // Determine column headers
  const headers = [
    { text: '#', bold: true, fontSize: 8, alignment: 'center', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Description', bold: true, fontSize: 8, fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'HSN/SAC', bold: true, fontSize: 8, alignment: 'center', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Qty', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Unit', bold: true, fontSize: 8, alignment: 'center', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Rate', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Disc %', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Taxable Amt', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
  ];

  if (!billOfSupply) {
    headers.push({ text: 'GST %', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });

    if (interState) {
      headers.push({ text: 'IGST', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });
    } else {
      headers.push({ text: 'CGST', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });
      headers.push({ text: 'SGST', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });
    }
  }

  headers.push({ text: 'Total', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });

  // Build rows
  const rows = items.map((item, index) => {
    const bgColor = index % 2 === 1 ? COLORS.rowAlt : COLORS.white;
    const taxableAmt = Number(item.taxable_amount) || 0;
    const quantity = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discount = Number(item.discount) || 0;
    const gstRate = Number(item.gst_rate) || 0;
    const cgstAmt = Number(item.cgst_amount) || 0;
    const sgstAmt = Number(item.sgst_amount) || 0;
    const igstAmt = Number(item.igst_amount) || 0;
    const total = Number(item.total) || (taxableAmt + cgstAmt + sgstAmt + igstAmt);

    const row = [
      { text: String(index + 1), fontSize: 8, alignment: 'center', fillColor: bgColor },
      { text: item.description || item.item_name || '', fontSize: 8, fillColor: bgColor },
      { text: item.hsn_code || item.hsn_sac || '', fontSize: 8, alignment: 'center', fillColor: bgColor },
      { text: quantity.toString(), fontSize: 8, alignment: 'right', fillColor: bgColor },
      { text: item.unit || 'PCS', fontSize: 8, alignment: 'center', fillColor: bgColor },
      { text: pdfAmount(rate), fontSize: 8, alignment: 'right', fillColor: bgColor },
      { text: discount > 0 ? `${discount}%` : '-', fontSize: 8, alignment: 'right', fillColor: bgColor },
      { text: pdfAmount(taxableAmt), fontSize: 8, alignment: 'right', fillColor: bgColor },
    ];

    if (!billOfSupply) {
      row.push({ text: `${gstRate}%`, fontSize: 8, alignment: 'right', fillColor: bgColor });

      if (interState) {
        row.push({ text: pdfAmount(igstAmt), fontSize: 8, alignment: 'right', fillColor: bgColor });
      } else {
        row.push({ text: pdfAmount(cgstAmt), fontSize: 8, alignment: 'right', fillColor: bgColor });
        row.push({ text: pdfAmount(sgstAmt), fontSize: 8, alignment: 'right', fillColor: bgColor });
      }
    }

    row.push({ text: pdfAmount(total), fontSize: 8, alignment: 'right', fillColor: bgColor });

    return row;
  });

  // Column widths
  let widths;
  if (billOfSupply) {
    // #, Desc, HSN, Qty, Unit, Rate, Disc, Taxable, Total
    widths = [20, '*', 45, 30, 30, 55, 35, 60, 60];
  } else if (interState) {
    // #, Desc, HSN, Qty, Unit, Rate, Disc, Taxable, GST%, IGST, Total
    widths = [18, '*', 40, 25, 25, 48, 30, 55, 30, 50, 55];
  } else {
    // #, Desc, HSN, Qty, Unit, Rate, Disc, Taxable, GST%, CGST, SGST, Total
    widths = [16, '*', 38, 22, 22, 45, 28, 50, 28, 45, 45, 50];
  }

  return {
    table: {
      headerRows: 1,
      widths: widths,
      body: [headers, ...rows],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.5 : 0.3,
      vLineWidth: () => 0.3,
      hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? COLORS.border : COLORS.lightBorder,
      vLineColor: () => COLORS.lightBorder,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 10],
  };
}

/**
 * Build the tax summary grouped by GST rate.
 */
function buildTaxSummary(invoice) {
  const items = invoice.items || [];
  const interState = isInterState(invoice);
  const billOfSupply = isBillOfSupply(invoice);

  // Group taxes by rate
  const taxGroups = {};
  items.forEach(item => {
    const gstRate = Number(item.gst_rate) || 0;
    if (!taxGroups[gstRate]) {
      taxGroups[gstRate] = { cgst: 0, sgst: 0, igst: 0, taxable: 0 };
    }
    taxGroups[gstRate].taxable += Number(item.taxable_amount) || 0;
    taxGroups[gstRate].cgst += Number(item.cgst_amount) || 0;
    taxGroups[gstRate].sgst += Number(item.sgst_amount) || 0;
    taxGroups[gstRate].igst += Number(item.igst_amount) || 0;
  });

  // Build summary rows
  const summaryRows = [];

  // Sub Total
  const subtotal = Number(invoice.subtotal) || items.reduce((sum, item) => sum + (Number(item.taxable_amount) || 0), 0);
  summaryRows.push([
    { text: 'Sub Total:', fontSize: 9, alignment: 'right', bold: true },
    { text: pdfAmount(subtotal), fontSize: 9, alignment: 'right' },
  ]);

  // Tax breakdown per rate
  if (!billOfSupply) {
    const sortedRates = Object.keys(taxGroups).map(Number).sort((a, b) => a - b);
    sortedRates.forEach(rate => {
      if (rate === 0) return;
      const group = taxGroups[rate];
      if (interState) {
        summaryRows.push([
          { text: `IGST @${rate}%:`, fontSize: 9, alignment: 'right' },
          { text: pdfAmount(group.igst), fontSize: 9, alignment: 'right' },
        ]);
      } else {
        const halfRate = rate / 2;
        summaryRows.push([
          { text: `CGST @${halfRate}%:`, fontSize: 9, alignment: 'right' },
          { text: pdfAmount(group.cgst), fontSize: 9, alignment: 'right' },
        ]);
        summaryRows.push([
          { text: `SGST @${halfRate}%:`, fontSize: 9, alignment: 'right' },
          { text: pdfAmount(group.sgst), fontSize: 9, alignment: 'right' },
        ]);
      }
    });

    // Total Tax
    const totalTax = Number(invoice.total_cgst || 0) + Number(invoice.total_sgst || 0) + Number(invoice.total_igst || 0);
    summaryRows.push([
      { text: 'Total Tax:', fontSize: 9, alignment: 'right', bold: true },
      { text: pdfAmount(totalTax), fontSize: 9, alignment: 'right' },
    ]);
  }

  // Round Off
  const roundOff = Number(invoice.round_off) || 0;
  if (roundOff !== 0) {
    summaryRows.push([
      { text: 'Round Off:', fontSize: 9, alignment: 'right' },
      { text: pdfAmount(roundOff), fontSize: 9, alignment: 'right' },
    ]);
  }

  // Grand Total
  const grandTotal = Number(invoice.total_payable) || Number(invoice.grand_total) || 0;
  summaryRows.push([
    { text: 'Grand Total:', fontSize: 11, alignment: 'right', bold: true, color: COLORS.primary },
    { text: pdfAmount(grandTotal), fontSize: 11, alignment: 'right', bold: true, color: COLORS.primary },
  ]);

  return {
    columns: [
      { width: '*', text: '' },
      {
        width: 250,
        table: {
          widths: ['*', 100],
          body: summaryRows,
        },
        layout: {
          hLineWidth: (i, node) => (i === node.table.body.length - 1 || i === node.table.body.length) ? 0.5 : 0,
          vLineWidth: () => 0,
          hLineColor: () => COLORS.border,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    margin: [0, 0, 0, 10],
  };
}

/**
 * Build the amount in words section.
 */
function buildAmountInWords(invoice) {
  const grandTotal = Number(invoice.total_payable) || Number(invoice.grand_total) || 0;
  const words = numberToWords(grandTotal);
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: 'Amount in Words:', fontSize: 8, bold: true, color: COLORS.textSecondary },
              { text: words, fontSize: 9, bold: true, italics: true, color: COLORS.primary, margin: [0, 2, 0, 0] },
            ],
            fillColor: COLORS.headerBg,
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => COLORS.lightBorder,
      vLineColor: () => COLORS.lightBorder,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 10],
  };
}

/**
 * Build the bank details section.
 */
function buildBankDetails(invoice, company) {
  const bank = invoice.bank_name || company.bank_name;
  const accountNo = invoice.account_number || company.account_number;
  const ifsc = invoice.ifsc_code || company.ifsc_code;
  const branch = invoice.bank_branch || company.bank_branch;

  if (!bank && !accountNo && !ifsc) return null;

  const bankRows = [];
  if (bank) bankRows.push(['Bank Name:', bank]);
  if (accountNo) bankRows.push(['Account No:', accountNo]);
  if (ifsc) bankRows.push(['IFSC Code:', ifsc]);
  if (branch) bankRows.push(['Branch:', branch]);

  const body = bankRows.map(([label, value]) => [
    { text: label, fontSize: 8, bold: true, color: COLORS.textSecondary },
    { text: value, fontSize: 8 },
  ]);

  return {
    stack: [
      { text: 'Bank Details:', fontSize: 10, bold: true, color: COLORS.primary, margin: [0, 0, 0, 4] },
      {
        table: {
          widths: [80, '*'],
          body: body,
        },
        layout: {
          hLineWidth: () => 0.3,
          vLineWidth: () => 0.3,
          hLineColor: () => COLORS.lightBorder,
          vLineColor: () => COLORS.lightBorder,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    margin: [0, 0, 0, 10],
  };
}

/**
 * Build terms and notes section.
 */
function buildTermsAndNotes(invoice) {
  const sections = [];

  if (invoice.terms_and_conditions || invoice.terms) {
    sections.push({
      stack: [
        { text: 'Terms & Conditions:', fontSize: 9, bold: true, color: COLORS.primary, margin: [0, 0, 0, 3] },
        { text: invoice.terms_and_conditions || invoice.terms, fontSize: 8, color: COLORS.textSecondary, lineHeight: 1.3 },
      ],
    });
  }

  if (invoice.notes) {
    sections.push({
      stack: [
        { text: 'Notes:', fontSize: 9, bold: true, color: COLORS.primary, margin: [0, 5, 0, 3] },
        { text: invoice.notes, fontSize: 8, color: COLORS.textSecondary, lineHeight: 1.3 },
      ],
    });
  }

  if (sections.length === 0) return null;

  return {
    stack: sections,
    margin: [0, 0, 0, 10],
  };
}

/**
 * Build the footer section with authorized signatory.
 */
function buildFooter(invoice, company) {
  return {
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: COLORS.lightBorder }], margin: [0, 10, 0, 10] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'This is a computer generated invoice', fontSize: 8, italics: true, color: COLORS.textSecondary },
            ],
          },
          {
            width: 200,
            stack: [
              { text: `For ${company.name || 'Company'}`, fontSize: 9, bold: true, alignment: 'right', color: COLORS.primary },
              { text: '', margin: [0, 30, 0, 0] },
              { text: 'Authorized Signatory', fontSize: 8, alignment: 'right', color: COLORS.textSecondary },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Build watermark for credit/debit notes.
 */
function buildWatermark(invoice) {
  if (invoice.invoice_type === 'credit_note') {
    return { text: 'CREDIT NOTE', color: COLORS.watermark, opacity: 0.15, bold: true, fontSize: 80, angle: 45 };
  }
  if (invoice.invoice_type === 'debit_note') {
    return { text: 'DEBIT NOTE', color: COLORS.watermark, opacity: 0.15, bold: true, fontSize: 80, angle: 45 };
  }
  return null;
}

/**
 * Generate and download a professional GST Invoice PDF.
 *
 * @param {Object} invoice - The invoice data object containing:
 *   - invoice_number, invoice_date, due_date, invoice_type
 *   - customer_name, customer_gstin, billing_address, billing_city, billing_state, billing_pincode
 *   - shipping_address, shipping_city, shipping_state, shipping_pincode (optional)
 *   - place_of_supply, company_state_code, reverse_charge
 *   - items: Array of { description, hsn_code, quantity, unit, rate, discount, gst_rate,
 *            taxable_amount, cgst_amount, sgst_amount, igst_amount, total }
 *   - subtotal, total_cgst, total_sgst, total_igst, round_off, grand_total, total_payable
 *   - bank_name, account_number, ifsc_code, bank_branch (optional)
 *   - terms_and_conditions, notes (optional)
 *   - original_invoice_number, original_invoice_date, reason (for credit/debit notes)
 * @param {Object} company - The company details object containing:
 *   - name, address, city, state, pincode, gstin, pan, phone, email
 *   - bank_name, account_number, ifsc_code, bank_branch (optional)
 */
export function generateInvoicePdf(invoice, company) {
  const content = [];

  // Header
  content.push(buildHeader(company));

  // Invoice Title
  content.push(...buildTitle(invoice));

  // Party and Invoice Details
  content.push(buildPartyAndInvoiceDetails(invoice));

  // Items Table
  content.push(buildItemsTable(invoice));

  // Tax Summary
  content.push(buildTaxSummary(invoice));

  // Amount in Words
  content.push(buildAmountInWords(invoice));

  // Bank Details
  const bankDetails = buildBankDetails(invoice, company);
  if (bankDetails) content.push(bankDetails);

  // Terms and Notes
  const termsAndNotes = buildTermsAndNotes(invoice);
  if (termsAndNotes) content.push(termsAndNotes);

  // Footer
  content.push(buildFooter(invoice, company));

  // Build document definition
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: content,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: COLORS.text,
    },
    styles: {
      header: { fontSize: 18, bold: true, color: COLORS.primary },
      subheader: { fontSize: 12, bold: true, color: COLORS.secondary },
    },
    info: {
      title: invoice.invoice_number || 'Invoice',
      author: company.name || 'GST Billing Software',
      subject: INVOICE_TYPES[invoice.invoice_type] || 'Tax Invoice',
    },
  };

  // Add watermark for credit/debit notes
  const watermark = buildWatermark(invoice);
  if (watermark) {
    docDefinition.watermark = watermark;
  }

  const filename = `${invoice.invoice_number || 'invoice'}.pdf`;
  pdfMake.createPdf(docDefinition).download(filename);
}
