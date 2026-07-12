import { describe, expect, it } from 'vitest';
import { countValid, getMissingFields } from './validation';
import type { InvoiceData } from './types';

function completeInvoice(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    documentType: 'faktura',
    invoiceNumber: '001/2026',
    issueDate: '2026-07-01',
    dueDate: '2026-07-31',
    seller: { pib: '123456789', name: 'Prodavac d.o.o.', address: 'Ulica 1', city: 'Novi Sad', country: 'RS', vatRegistered: true },
    buyer: { pib: '987654321', name: 'Kupac d.o.o.', address: 'Ulica 2', city: 'Beograd', country: 'RS' },
    items: [{ id: '1', description: 'Usluga', quantity: 1, unit: 'kom', unitPrice: 100, vatRate: 20 }],
    currency: 'RSD',
    ...overrides,
  };
}

const labels = {
  documentNumber: 'documentNumber', invoiceNumber: 'invoiceNumber',
  seller: 'seller', buyer: 'buyer', companyName: 'companyName',
  pib: 'pib', issueDate: 'issueDate', dueDate: 'dueDate', items: 'items',
};

describe('countValid', () => {
  it('counts 8/8 for a complete faktura', () => {
    expect(countValid(completeInvoice())).toEqual({ valid: 8, total: 8 });
  });

  it('counts 7/7 for a complete otpremnica (dueDate not required)', () => {
    const data = completeInvoice({ documentType: 'otpremnica', dueDate: undefined });
    expect(countValid(data)).toEqual({ valid: 7, total: 7 });
  });

  it('never reports valid above total', () => {
    const data = completeInvoice({ documentType: 'otpremnica', dueDate: '2026-07-31' });
    const { valid, total } = countValid(data);
    expect(valid).toBeLessThanOrEqual(total);
  });

  it('keeps otpremnica incomplete while a required field is missing', () => {
    const data = completeInvoice({
      documentType: 'otpremnica',
      dueDate: undefined,
      items: [{ id: '1', description: '', quantity: 1, unit: 'kom', unitPrice: 0, vatRate: 20 }],
    });
    const { valid, total } = countValid(data);
    expect(valid).toBeLessThan(total);
  });

  it('rejects PIB that is not exactly 9 digits', () => {
    const data = completeInvoice({
      seller: { ...completeInvoice().seller, pib: '12345678' },
    });
    expect(countValid(data).valid).toBe(7);
  });
});

describe('getMissingFields', () => {
  it('returns nothing for a complete faktura', () => {
    expect(getMissingFields(completeInvoice(), labels)).toEqual([]);
  });

  it('lists items and issue date when missing on otpremnica', () => {
    const data = completeInvoice({
      documentType: 'otpremnica',
      dueDate: undefined,
      issueDate: '',
      items: [],
    });
    const missing = getMissingFields(data, labels);
    expect(missing).toContain('issueDate');
    expect(missing).toContain('items');
    expect(missing).not.toContain('dueDate');
  });
});
