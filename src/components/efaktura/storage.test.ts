import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuyerData, InvoiceData } from './types';
import {
  clearSavedEfakturaData,
  hasStorageConsent,
  loadSavedBuyers,
  loadSavedItems,
  loadSavedSeller,
  persistBuyer,
  persistItems,
  setStorageConsent,
} from './storage';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const buyerPib = '123456789';
const buyer: BuyerData = {
  name: 'Audit Buyer',
  pib: buyerPib,
  address: 'Main 1',
  city: 'Novi Sad',
  country: 'RS',
};

const items: InvoiceData['items'] = [
  { id: '1', description: 'Audit item', quantity: 1, unit: 'kom', unitPrice: 100, vatRate: 20 },
];

describe('e-Faktura local storage privacy', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores saved data until the user opts in', () => {
    localStorage.setItem('efaktura-seller', JSON.stringify({ name: 'Seller', pib: '123456789' }));
    localStorage.setItem('efaktura-buyers', JSON.stringify({ '123456789': buyer }));
    localStorage.setItem('efaktura-items', JSON.stringify(items));

    expect(hasStorageConsent()).toBe(false);
    expect(loadSavedSeller()).toBeNull();
    expect(loadSavedBuyers()).toEqual({});
    expect(loadSavedItems()).toEqual([]);
  });

  it('persists and then clears saved data when consent is revoked', () => {
    setStorageConsent(true);
    persistBuyer(buyerPib, buyer);
    persistItems(items);

    expect(loadSavedBuyers()).toEqual({ [buyerPib]: { name: buyer.name, address: buyer.address, city: buyer.city } });
    expect(loadSavedItems()).toHaveLength(1);

    clearSavedEfakturaData();

    expect(hasStorageConsent()).toBe(false);
    expect(localStorage.getItem('efaktura-seller')).toBeNull();
    expect(localStorage.getItem('efaktura-buyers')).toBeNull();
    expect(localStorage.getItem('efaktura-items')).toBeNull();
  });
});
