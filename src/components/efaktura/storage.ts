import type { BuyerData, InvoiceData, SellerData } from './types';

export interface SavedBuyer {
  name: string;
  address: string;
  city: string;
}

export interface SavedItem {
  description: string;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

const STORAGE_CONSENT_KEY = 'efaktura-storage-consent';
const SELLER_KEY = 'efaktura-seller';
const BUYERS_KEY = 'efaktura-buyers';
const ITEMS_KEY = 'efaktura-items';

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function hasStorageConsent(): boolean {
  return getStorage()?.getItem(STORAGE_CONSENT_KEY) === 'true';
}

export function setStorageConsent(enabled: boolean): void {
  const storage = getStorage();
  if (!storage) return;

  if (enabled) {
    storage.setItem(STORAGE_CONSENT_KEY, 'true');
  } else {
    clearSavedEfakturaData();
  }
}

export function clearSavedEfakturaData(): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(STORAGE_CONSENT_KEY);
  storage.removeItem(SELLER_KEY);
  storage.removeItem(BUYERS_KEY);
  storage.removeItem(ITEMS_KEY);
}

export function loadSavedSeller(): SellerData | null {
  const storage = getStorage();
  if (!storage || !hasStorageConsent()) return null;

  try {
    const parsed = JSON.parse(storage.getItem(SELLER_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.name !== 'string' || typeof parsed.pib !== 'string') return null;

    return {
      pib: parsed.pib,
      mb: typeof parsed.mb === 'string' ? parsed.mb : undefined,
      name: parsed.name,
      address: typeof parsed.address === 'string' ? parsed.address : '',
      city: typeof parsed.city === 'string' ? parsed.city : '',
      postalCode: typeof parsed.postalCode === 'string' ? parsed.postalCode : undefined,
      country: typeof parsed.country === 'string' ? parsed.country : 'RS',
      bankAccount: typeof parsed.bankAccount === 'string' ? parsed.bankAccount : undefined,
      bankName: typeof parsed.bankName === 'string' ? parsed.bankName : undefined,
      vatRegistered: typeof parsed.vatRegistered === 'boolean' ? parsed.vatRegistered : false,
    };
  } catch {
    return null;
  }
}

export function persistSeller(seller: SellerData): void {
  const storage = getStorage();
  if (!storage || !hasStorageConsent()) return;

  storage.setItem(SELLER_KEY, JSON.stringify(seller));
}

export function loadSavedBuyers(): Record<string, SavedBuyer> {
  const storage = getStorage();
  if (!storage || !hasStorageConsent()) return {};

  try {
    const parsed = JSON.parse(storage.getItem(BUYERS_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, SavedBuyer> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (
        val &&
        typeof val === 'object' &&
        typeof (val as any).name === 'string' &&
        typeof (val as any).address === 'string' &&
        typeof (val as any).city === 'string'
      ) {
        result[key] = val as SavedBuyer;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function persistBuyer(pib: string | undefined, buyer: BuyerData): void {
  const storage = getStorage();
  if (!storage || !hasStorageConsent() || !pib) return;

  const all = loadSavedBuyers();
  all[pib] = { name: buyer.name, address: buyer.address, city: buyer.city };
  storage.setItem(BUYERS_KEY, JSON.stringify(all));
}

export function loadSavedItems(): SavedItem[] {
  const storage = getStorage();
  if (!storage || !hasStorageConsent()) return [];

  try {
    const parsed = JSON.parse(storage.getItem(ITEMS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: unknown): item is SavedItem =>
      !!item && typeof item === 'object' &&
      typeof (item as any).description === 'string' &&
      typeof (item as any).unit === 'string' &&
      typeof (item as any).unitPrice === 'number' &&
      typeof (item as any).vatRate === 'number'
    );
  } catch {
    return [];
  }
}

export function persistItems(items: InvoiceData['items']): void {
  const storage = getStorage();
  if (!storage || !hasStorageConsent()) return;

  const saved = loadSavedItems();
  for (const item of items) {
    if (!item.description?.trim()) continue;
    const entry: SavedItem = {
      description: item.description,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
    };
    const idx = saved.findIndex(s => s.description === item.description);
    if (idx >= 0) saved[idx] = entry;
    else saved.unshift(entry);
  }
  storage.setItem(ITEMS_KEY, JSON.stringify(saved.slice(0, 50)));
}
