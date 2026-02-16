// Client-side types matching the backend InvoiceData
// Keep in sync with lako-bot/src/efaktura/shared/invoice-data.ts

export interface SellerData {
  pib: string;
  mb?: string;
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  bankAccount?: string;
  bankName?: string;
  vatRegistered: boolean;
}

export interface BuyerData {
  pib?: string;
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  vatRegistered?: boolean;
}

export interface InvoiceItem {
  id: string;  // client-side only for React key
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  deliveryDate?: string;
  seller: SellerData;
  buyer: BuyerData;
  items: InvoiceItem[];
  paymentMeansCode: string;
  paymentReference?: string;
  notes?: string;
  currency: string;
}

export interface InvoiceLineItem extends InvoiceItem {
  vatAmount: number;
  totalAmount: number;
}

export interface VatSummaryEntry {
  rate: number;
  base: number;
  amount: number;
}

export function computeTotals(data: InvoiceData) {
  const lineItems: InvoiceLineItem[] = data.items.map(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const vatAmount = data.seller.vatRegistered && item.vatRate > 0
      ? Math.round(lineTotal * item.vatRate / 100 * 100) / 100
      : 0;
    return { ...item, vatAmount, totalAmount: lineTotal + vatAmount };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const totalVat = lineItems.reduce((s, li) => s + li.vatAmount, 0);
  const grandTotal = subtotal + totalVat;

  const vatMap = new Map<number, { base: number; amount: number }>();
  for (const li of lineItems) {
    const e = vatMap.get(li.vatRate) || { base: 0, amount: 0 };
    e.base += li.quantity * li.unitPrice;
    e.amount += li.vatAmount;
    vatMap.set(li.vatRate, e);
  }
  const vatSummary: VatSummaryEntry[] = Array.from(vatMap.entries())
    .map(([rate, { base, amount }]) => ({ rate, base, amount }))
    .sort((a, b) => b.rate - a.rate);

  return { lineItems, subtotal: Math.round(subtotal * 100) / 100, totalVat: Math.round(totalVat * 100) / 100, grandTotal: Math.round(grandTotal * 100) / 100, vatSummary };
}

export function generatePaymentReference(invoiceNumber: string): string {
  const digits = invoiceNumber.replace(/\D/g, '');
  if (!digits) return '00';
  const num = BigInt(digits + '00');
  const remainder = num % 97n;
  const checkDigits = String(98n - remainder).padStart(2, '0');
  return `${checkDigits}${digits}`;
}

// Default empty invoice
export function createEmptyInvoice(): InvoiceData {
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  return {
    invoiceNumber: '',
    issueDate: today,
    dueDate: due,
    deliveryDate: today,
    seller: { pib: '', name: '', address: '', city: '', country: 'RS', vatRegistered: false },
    buyer: { pib: '', name: '', address: '', city: '', country: 'RS' },
    items: [{ id: crypto.randomUUID(), description: '', quantity: 1, unit: 'kom', unitPrice: 0, vatRate: 20 }],
    paymentMeansCode: '30',
    currency: 'RSD',
  };
}
