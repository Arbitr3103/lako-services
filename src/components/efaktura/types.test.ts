import { describe, expect, it } from 'vitest';
import { computeTotals, generatePaymentReference } from './types';
import type { InvoiceData } from './types';

function invoice(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    documentType: 'faktura',
    invoiceNumber: '001/2026',
    issueDate: '2026-07-01',
    seller: { pib: '123456789', name: 'Prodavac', address: '', city: '', country: 'RS', vatRegistered: true },
    buyer: { name: 'Kupac', address: '', city: '', country: 'RS' },
    items: [{ id: '1', description: 'Usluga', quantity: 2, unit: 'kom', unitPrice: 100, vatRate: 20 }],
    currency: 'RSD',
    ...overrides,
  };
}

describe('computeTotals', () => {
  it('applies VAT per line for VAT-registered sellers', () => {
    const { subtotal, totalVat, grandTotal, lineItems } = computeTotals(invoice());
    expect(subtotal).toBe(200);
    expect(totalVat).toBe(40);
    expect(grandTotal).toBe(240);
    expect(lineItems[0].vatAmount).toBe(40);
    expect(lineItems[0].totalAmount).toBe(240);
  });

  it('charges no VAT when the seller is not VAT-registered', () => {
    const data = invoice();
    data.seller.vatRegistered = false;
    const { subtotal, totalVat, grandTotal } = computeTotals(data);
    expect(subtotal).toBe(200);
    expect(totalVat).toBe(0);
    expect(grandTotal).toBe(200);
  });

  it('groups the VAT summary by rate, highest first', () => {
    const data = invoice({
      items: [
        { id: '1', description: 'A', quantity: 1, unit: 'kom', unitPrice: 100, vatRate: 20 },
        { id: '2', description: 'B', quantity: 1, unit: 'kom', unitPrice: 100, vatRate: 10 },
        { id: '3', description: 'C', quantity: 1, unit: 'kom', unitPrice: 50, vatRate: 20 },
      ],
    });
    const { vatSummary } = computeTotals(data);
    expect(vatSummary).toEqual([
      { rate: 20, base: 150, amount: 30 },
      { rate: 10, base: 100, amount: 10 },
    ]);
  });

  it('rounds VAT per line to 2 decimals', () => {
    const data = invoice({
      items: [{ id: '1', description: 'A', quantity: 1, unit: 'kom', unitPrice: 33.33, vatRate: 20 }],
    });
    const { totalVat, grandTotal } = computeTotals(data);
    expect(totalVat).toBe(6.67);
    expect(grandTotal).toBe(40);
  });
});

describe('generatePaymentReference', () => {
  it('prepends mod-97 check digits to the invoice number digits', () => {
    // digits '0012026' -> 120260000... check: 98 - (1202600 % 97) = 7
    expect(generatePaymentReference('001/2026')).toBe('070012026');
  });

  it('pads single-digit check numbers with a leading zero', () => {
    const ref = generatePaymentReference('001/2026');
    expect(ref.slice(0, 2)).toMatch(/^\d{2}$/);
  });

  it('returns "00" when the invoice number has no digits', () => {
    expect(generatePaymentReference('draft')).toBe('00');
  });

  it('is a valid model-97 reference (check digits verify)', () => {
    for (const num of ['001/2026', 'F-123/2026', '42']) {
      const ref = generatePaymentReference(num);
      const check = BigInt(ref.slice(0, 2));
      const digits = ref.slice(2);
      // Model 97: check = 98 - (digits * 100 mod 97)
      expect(98n - (BigInt(digits + '00') % 97n)).toBe(check);
    }
  });
});
