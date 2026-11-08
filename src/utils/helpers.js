/**
 * Format currency in Indian number system: ₹1,23,456.00
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const [intPart, decPart] = absNum.toFixed(2).split('.');
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const groups = [];
    for (let i = remaining.length; i > 0; i -= 2) {
      groups.unshift(remaining.slice(Math.max(0, i - 2), i));
    }
    formatted = groups.join(',') + ',' + lastThree;
  }
  return `${isNegative ? '-' : ''}₹${formatted}.${decPart}`;
}

/**
 * Format date string to DD/MM/YYYY
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date string to YYYY-MM-DD for HTML date input fields
 */
export function formatDateInput(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date as YYYY-MM-DD
 */
export function getToday() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Convert number to Indian English words (for invoice total in words)
 */
export function numberToWords(num) {
  if (num === 0) return 'Zero';
  if (num === null || num === undefined || isNaN(num)) return '';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
  }

  function threeDigits(n) {
    if (n === 0) return '';
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + twoDigits(n % 100) : '');
  }

  const absNum = Math.abs(Math.floor(num));
  const paise = Math.round((Math.abs(num) - absNum) * 100);

  if (absNum === 0 && paise > 0) {
    return twoDigits(paise) + ' Paise Only';
  }

  let result = '';
  const crore = Math.floor(absNum / 10000000);
  const lakh = Math.floor((absNum % 10000000) / 100000);
  const thousand = Math.floor((absNum % 100000) / 1000);
  const hundred = absNum % 1000;

  if (crore > 0) {
    result += threeDigits(crore) + ' Crore ';
  }
  if (lakh > 0) {
    result += twoDigits(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    result += twoDigits(thousand) + ' Thousand ';
  }
  if (hundred > 0) {
    result += threeDigits(hundred);
  }

  result = result.trim() + ' Rupees';

  if (paise > 0) {
    result += ' and ' + twoDigits(paise) + ' Paise';
  }

  result += ' Only';

  return (num < 0 ? 'Minus ' : '') + result;
}

/**
 * Available GST rates
 */
export const GST_RATES = [0, 5, 12, 18, 28];

/**
 * Measurement units
 */
export const UNITS = ['PCS', 'KG', 'LTR', 'MTR', 'BOX', 'NOS', 'SET', 'SQF', 'SQM', 'HRS'];

/**
 * Indian state code mapping (GST state codes)
 */
export const STATE_CODES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
};

/**
 * Calculate totals for a single line item
 * @param {Object} item - { quantity, rate, discount, gst_rate }
 * @param {boolean} isInterState - true for IGST, false for CGST+SGST
 * @returns {Object} - { taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total }
 */
export function calculateItemTotals(item, isInterState) {
  const quantity = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const discount = Number(item.discount) || 0;
  const gstRate = Number(item.gst_rate) || 0;

  const grossAmount = quantity * rate;
  const discountAmount = (grossAmount * discount) / 100;
  const taxableAmount = grossAmount - discountAmount;

  let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;

  if (isInterState) {
    igstRate = gstRate;
    igstAmount = (taxableAmount * igstRate) / 100;
  } else {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = (taxableAmount * cgstRate) / 100;
    sgstAmount = (taxableAmount * sgstRate) / 100;
  }

  const total = taxableAmount + cgstAmount + sgstAmount + igstAmount;

  return {
    taxable_amount: Math.round(taxableAmount * 100) / 100,
    cgst_rate: Math.round(cgstRate * 100) / 100,
    cgst_amount: Math.round(cgstAmount * 100) / 100,
    sgst_rate: Math.round(sgstRate * 100) / 100,
    sgst_amount: Math.round(sgstAmount * 100) / 100,
    igst_rate: Math.round(igstRate * 100) / 100,
    igst_amount: Math.round(igstAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Calculate totals for an entire invoice
 * @param {Array} items - Array of line items
 * @param {boolean} isInterState - true for IGST, false for CGST+SGST
 * @returns {Object} - Aggregated totals
 */
export function calculateInvoiceTotals(items, isInterState) {
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalDiscount = 0;
  let grandTotal = 0;

  const calculatedItems = items.map((item) => {
    const totals = calculateItemTotals(item, isInterState);
    const quantity = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discount = Number(item.discount) || 0;
    const grossAmount = quantity * rate;
    const discountAmount = (grossAmount * discount) / 100;

    subtotal += totals.taxable_amount;
    totalCgst += totals.cgst_amount;
    totalSgst += totals.sgst_amount;
    totalIgst += totals.igst_amount;
    totalDiscount += discountAmount;
    grandTotal += totals.total;

    return { ...item, ...totals };
  });

  return {
    items: calculatedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    total_cgst: Math.round(totalCgst * 100) / 100,
    total_sgst: Math.round(totalSgst * 100) / 100,
    total_igst: Math.round(totalIgst * 100) / 100,
    total_discount: Math.round(totalDiscount * 100) / 100,
    grand_total: Math.round(grandTotal * 100) / 100,
    round_off: Math.round(grandTotal) - Math.round(grandTotal * 100) / 100,
    total_payable: Math.round(grandTotal),
  };
}
