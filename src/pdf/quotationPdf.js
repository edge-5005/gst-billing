import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { formatCurrency, formatDate } from '../utils/helpers';

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

/**
 * Color palette for the PDF
 */
const COLORS = {
  primary: '#1a237e',
  secondary: '#283593',
  headerBg: '#e8eaf6',
  rowAlt: '#f5f5f5',
  border: '#bdbdbd',
  lightBorder: '#e0e0e0',
  text: '#212121',
  textSecondary: '#616161',
  white: '#ffffff',
};

/**
 * Format amount for PDF display.
 */
function pdfAmount(amount) {
  return formatCurrency(amount);
}

/**
 * Build the header section for the quotation.
 */
function buildHeader(company) {
  const companyDetails = [];
  const addressParts = [];

  if (company.address) addressParts.push(company.address);
  if (company.city) addressParts.push(company.city);
  if (company.state) addressParts.push(company.state);
  if (company.pincode) addressParts.push(`- ${company.pincode}`);

  if (addressParts.length > 0) {
    companyDetails.push({ text: addressParts.join(', '), fontSize: 9, color: COLORS.textSecondary, margin: [0, 2, 0, 0], alignment: 'center' });
  }

  const infoParts = [];
  if (company.gstin) infoParts.push(`GSTIN: ${company.gstin}`);
  if (company.pan) infoParts.push(`PAN: ${company.pan}`);
  if (company.phone) infoParts.push(`Phone: ${company.phone}`);
  if (company.email) infoParts.push(`Email: ${company.email}`);

  if (infoParts.length > 0) {
    companyDetails.push({ text: infoParts.join('  |  '), fontSize: 8, color: COLORS.textSecondary, margin: [0, 3, 0, 0] });
  }

  const hasLogo = company.logo_url && (
    company.logo_url.startsWith('data:image/png') ||
    company.logo_url.startsWith('data:image/jpeg') ||
    company.logo_url.startsWith('data:image/jpg')
  );

  if (hasLogo) {
    return {
      columns: [
        {
          image: company.logo_url,
          width: 80,
          fit: [80, 50],
          margin: [0, 0, 15, 0],
        },
        {
          stack: [
            { text: company.name || 'Company Name', fontSize: 16, bold: true, color: COLORS.primary },
            ...companyDetails,
          ],
          width: '*',
        },
      ],
      margin: [0, 0, 0, 10],
    };
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
 * Build the quotation title section.
 */
function buildTitle(quotation) {
  const title = quotation.quotation_type === 'estimate' ? 'ESTIMATE' : 'QUOTATION';
  return [
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: COLORS.border }], margin: [0, 5, 0, 5] },
    { text: title, fontSize: 14, bold: true, alignment: 'center', color: COLORS.primary, margin: [0, 0, 0, 5] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: COLORS.lightBorder }], margin: [0, 0, 0, 10] },
  ];
}

/**
 * Build party details and quotation info two-column section.
 */
function buildPartyAndQuotationDetails(quotation) {
  // Left column: To
  const toStack = [
    { text: 'To:', fontSize: 10, bold: true, color: COLORS.primary, margin: [0, 0, 0, 4] },
    { text: quotation.customer_name || '', fontSize: 10, bold: true },
  ];

  if (quotation.customer_gstin) {
    toStack.push({ text: `GSTIN: ${quotation.customer_gstin}`, fontSize: 8, color: COLORS.textSecondary, margin: [0, 2, 0, 0] });
  }

  const addressLines = [];
  if (quotation.customer_address || quotation.billing_address) {
    addressLines.push(quotation.customer_address || quotation.billing_address);
  }
  const cityStateParts = [];
  if (quotation.customer_city || quotation.billing_city) cityStateParts.push(quotation.customer_city || quotation.billing_city);
  if (quotation.customer_state || quotation.billing_state) cityStateParts.push(quotation.customer_state || quotation.billing_state);
  if (quotation.customer_pincode || quotation.billing_pincode) cityStateParts.push(`- ${quotation.customer_pincode || quotation.billing_pincode}`);
  if (cityStateParts.length > 0) addressLines.push(cityStateParts.join(', '));

  if (quotation.customer_phone) {
    addressLines.push(`Phone: ${quotation.customer_phone}`);
  }
  if (quotation.customer_email) {
    addressLines.push(`Email: ${quotation.customer_email}`);
  }

  addressLines.forEach(line => {
    toStack.push({ text: line, fontSize: 9, color: COLORS.textSecondary, margin: [0, 1, 0, 0] });
  });

  // Right column: Quotation Details
  const detailsRows = [
    ['Quotation No:', quotation.quotation_number || quotation.estimate_number || ''],
    ['Date:', formatDate(quotation.quotation_date || quotation.date)],
  ];

  if (quotation.valid_until || quotation.valid_date) {
    detailsRows.push(['Valid Until:', formatDate(quotation.valid_until || quotation.valid_date)]);
  }

  if (quotation.reference) {
    detailsRows.push(['Reference:', quotation.reference]);
  }

  const detailsBody = detailsRows.map(([label, value]) => [
    { text: label, fontSize: 9, bold: true, color: COLORS.textSecondary },
    { text: value, fontSize: 9 },
  ]);

  const rightColumn = {
    stack: [
      { text: 'Quotation Details:', fontSize: 10, bold: true, color: COLORS.primary, margin: [0, 0, 0, 4] },
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
      { stack: toStack, width: '50%' },
      { stack: [rightColumn], width: '50%' },
    ],
    margin: [0, 0, 0, 15],
  };
}

/**
 * Determine if the quotation is inter-state.
 */
function isInterState(quotation) {
  const companyState = quotation.company_state_code || '';
  const customerState = quotation.place_of_supply || quotation.customer_state_code || '';
  return String(companyState).padStart(2, '0') !== String(customerState).padStart(2, '0');
}

/**
 * Build the items table.
 */
function buildItemsTable(quotation) {
  const items = quotation.items || [];
  const interState = isInterState(quotation);

  const headers = [
    { text: '#', bold: true, fontSize: 8, alignment: 'center', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Description', bold: true, fontSize: 8, fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'HSN/SAC', bold: true, fontSize: 8, alignment: 'center', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Qty', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Unit', bold: true, fontSize: 8, alignment: 'center', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Rate', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Disc %', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'Taxable Amt', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
    { text: 'GST %', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary },
  ];

  if (interState) {
    headers.push({ text: 'IGST', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });
  } else {
    headers.push({ text: 'CGST', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });
    headers.push({ text: 'SGST', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });
  }

  headers.push({ text: 'Total', bold: true, fontSize: 8, alignment: 'right', fillColor: COLORS.headerBg, color: COLORS.primary });

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
      { text: `${gstRate}%`, fontSize: 8, alignment: 'right', fillColor: bgColor },
    ];

    if (interState) {
      row.push({ text: pdfAmount(igstAmt), fontSize: 8, alignment: 'right', fillColor: bgColor });
    } else {
      row.push({ text: pdfAmount(cgstAmt), fontSize: 8, alignment: 'right', fillColor: bgColor });
      row.push({ text: pdfAmount(sgstAmt), fontSize: 8, alignment: 'right', fillColor: bgColor });
    }

    row.push({ text: pdfAmount(total), fontSize: 8, alignment: 'right', fillColor: bgColor });

    return row;
  });

  let widths;
  if (interState) {
    widths = [18, '*', 40, 25, 25, 48, 30, 55, 30, 50, 55];
  } else {
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
 * Build the summary section.
 */
function buildSummary(quotation) {
  const items = quotation.items || [];
  const interState = isInterState(quotation);

  const taxGroups = {};
  items.forEach(item => {
    const gstRate = Number(item.gst_rate) || 0;
    if (!taxGroups[gstRate]) {
      taxGroups[gstRate] = { cgst: 0, sgst: 0, igst: 0 };
    }
    taxGroups[gstRate].cgst += Number(item.cgst_amount) || 0;
    taxGroups[gstRate].sgst += Number(item.sgst_amount) || 0;
    taxGroups[gstRate].igst += Number(item.igst_amount) || 0;
  });

  const summaryRows = [];

  const subtotal = Number(quotation.subtotal) || items.reduce((sum, item) => sum + (Number(item.taxable_amount) || 0), 0);
  summaryRows.push([
    { text: 'Sub Total:', fontSize: 9, alignment: 'right', bold: true },
    { text: pdfAmount(subtotal), fontSize: 9, alignment: 'right' },
  ]);

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

  const totalTax = Number(quotation.total_cgst || 0) + Number(quotation.total_sgst || 0) + Number(quotation.total_igst || 0);
  if (totalTax > 0) {
    summaryRows.push([
      { text: 'Total Tax:', fontSize: 9, alignment: 'right', bold: true },
      { text: pdfAmount(totalTax), fontSize: 9, alignment: 'right' },
    ]);
  }

  const grandTotal = Number(quotation.total_payable) || Number(quotation.grand_total) || 0;
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
 * Build terms and notes section.
 */
function buildTermsAndNotes(quotation) {
  const sections = [];

  if (quotation.terms_and_conditions || quotation.terms) {
    sections.push({
      stack: [
        { text: 'Terms & Conditions:', fontSize: 9, bold: true, color: COLORS.primary, margin: [0, 0, 0, 3] },
        { text: quotation.terms_and_conditions || quotation.terms, fontSize: 8, color: COLORS.textSecondary, lineHeight: 1.3 },
      ],
    });
  }

  if (quotation.notes) {
    sections.push({
      stack: [
        { text: 'Notes:', fontSize: 9, bold: true, color: COLORS.primary, margin: [0, 5, 0, 3] },
        { text: quotation.notes, fontSize: 8, color: COLORS.textSecondary, lineHeight: 1.3 },
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
 * Build the footer section.
 */
function buildFooter(quotation, company) {
  const validUntil = quotation.valid_until || quotation.valid_date;
  const footerText = validUntil
    ? `This quotation is valid until ${formatDate(validUntil)}`
    : 'This is a computer generated quotation';

  return {
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: COLORS.lightBorder }], margin: [0, 10, 0, 10] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: footerText, fontSize: 8, italics: true, color: COLORS.textSecondary },
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
 * Generate and download a professional Quotation/Estimate PDF.
 *
 * @param {Object} quotation - The quotation data object containing:
 *   - quotation_number, quotation_date, valid_until, quotation_type
 *   - customer_name, customer_gstin, customer_address, customer_city, customer_state, customer_pincode
 *   - customer_phone, customer_email (optional)
 *   - company_state_code, place_of_supply, customer_state_code
 *   - items: Array of { description, hsn_code, quantity, unit, rate, discount, gst_rate,
 *            taxable_amount, cgst_amount, sgst_amount, igst_amount, total }
 *   - subtotal, total_cgst, total_sgst, total_igst, grand_total, total_payable
 *   - terms_and_conditions, notes (optional)
 *   - reference (optional)
 * @param {Object} company - The company details object
 */
export function generateQuotationPdf(quotation, company) {
  const content = [];

  // Header
  content.push(buildHeader(company));

  // Title
  content.push(...buildTitle(quotation));

  // Party and Quotation Details
  content.push(buildPartyAndQuotationDetails(quotation));

  // Items Table
  content.push(buildItemsTable(quotation));

  // Summary
  content.push(buildSummary(quotation));

  // Terms and Notes
  const termsAndNotes = buildTermsAndNotes(quotation);
  if (termsAndNotes) content.push(termsAndNotes);

  // Footer
  content.push(buildFooter(quotation, company));

  const title = quotation.quotation_type === 'estimate' ? 'Estimate' : 'Quotation';

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
      title: quotation.quotation_number || title,
      author: company.name || 'GST Billing Software',
      subject: title,
    },
  };

  const filename = `${quotation.quotation_number || quotation.estimate_number || 'quotation'}.pdf`;
  pdfMake.createPdf(docDefinition).download(filename);
}
