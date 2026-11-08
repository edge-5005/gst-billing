export const INVOICE_TYPES = {
  tax_invoice: 'Tax Invoice',
  bill_of_supply: 'Bill of Supply',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
};

export const INVOICE_STATUSES = {
  unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-700' },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
};

export const QUOTATION_STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  converted: { label: 'Converted', color: 'bg-purple-100 text-purple-700' },
};

export const PO_STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  received: { label: 'Received', color: 'bg-purple-100 text-purple-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
];
