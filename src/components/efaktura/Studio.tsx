import { useReducer, useState, useEffect, useRef } from 'react';
import InvoicePreview from './InvoicePreview';
import type { InvoiceData, BuyerData } from './types';
import { createEmptyInvoice, generatePaymentReference } from './types';

interface Props {
  locale: string;
  apiUrl: string;
}

const translations: Record<string, Record<string, string>> = {
  sr: {
    seller: 'Prodavac', buyer: 'Kupac', items: 'Stavke', details: 'Detalji',
    preview: 'Pregled', form: 'Forma', generate: 'Generiši fakturu',
    downloadPdf: 'Preuzmi PDF', downloadXml: 'Preuzmi XML',
    invoiceNumber: 'Broj fakture', issueDate: 'Datum izdavanja',
    deliveryDate: 'Datum isporuke', dueDate: 'Rok plaćanja',
    paymentReference: 'Poziv na broj', paymentRefAuto: 'automatski iz broja fakture', notes: 'Napomene',
    description: 'Opis', quantity: 'Kol.', unit: 'Jed.',
    unitPrice: 'Cena', vatRate: 'PDV %', amount: 'Iznos',
    addItem: '+ Dodaj stavku', removeItem: 'Obriši',
    pib: 'PIB', companyName: 'Naziv firme', address: 'Adresa',
    city: 'Grad', bankAccount: 'Tekući račun', bankName: 'Banka',
    vatRegistered: 'U sistemu PDV', editCompany: 'Izmeni podatke firme',
    saveBuyer: 'Sačuvaj kupca', validFields: 'polja validno',
    generating: 'Generisanje...', success: 'Faktura uspešno generisana!',
    error: 'Greška pri generisanju', mb: 'Matični broj',
    subtotal: 'Osnovica', vat: 'PDV', total: 'Ukupno',
    days7: '7 dana', days15: '15 dana', days30: '30 dana', days60: '60 dana',
    quickSelect: 'Brzi izbor',
    currency: 'RSD', postalCode: 'Poštanski broj', country: 'Država',
    buyerAutoFilled: 'Kupac pronađen iz istorije',
    pibHint: '9 cifara', bankAccountHint: 'npr. 160-0000000000000-00',
    proUpsell: 'Želite više mogućnosti?',
    proFeatures: 'Bez limita \u00b7 bez žiga \u00b7 istorija \u00b7 e-Potpis',
    proAction: 'Isprobajte Pro',
    limitReachedAnon: 'Dostigli ste mesečni limit od 3 besplatne fakture.',
    limitReachedFree: 'Dostigli ste mesečni limit od 10 faktura.',
    limitCtaAnon: 'Napravite nalog za 10 faktura mesečno',
    limitCtaPro: 'Nadogradite na Pro za neograničen broj',
  },
  en: {
    seller: 'Seller', buyer: 'Buyer', items: 'Items', details: 'Details',
    preview: 'Preview', form: 'Form', generate: 'Generate invoice',
    downloadPdf: 'Download PDF', downloadXml: 'Download XML',
    invoiceNumber: 'Invoice number', issueDate: 'Issue date',
    deliveryDate: 'Delivery date', dueDate: 'Due date',
    paymentReference: 'Payment reference', paymentRefAuto: 'auto-generated from invoice number', notes: 'Notes',
    description: 'Description', quantity: 'Qty', unit: 'Unit',
    unitPrice: 'Price', vatRate: 'VAT %', amount: 'Amount',
    addItem: '+ Add item', removeItem: 'Remove',
    pib: 'PIB', companyName: 'Company name', address: 'Address',
    city: 'City', bankAccount: 'Bank account', bankName: 'Bank name',
    vatRegistered: 'VAT registered', editCompany: 'Edit company',
    saveBuyer: 'Save buyer', validFields: 'fields valid',
    generating: 'Generating...', success: 'Invoice generated!',
    error: 'Error generating invoice', mb: 'Registration number',
    subtotal: 'Subtotal', vat: 'VAT', total: 'Total',
    days7: '7 days', days15: '15 days', days30: '30 days', days60: '60 days',
    quickSelect: 'Quick select',
    currency: 'RSD', postalCode: 'Postal code', country: 'Country',
    buyerAutoFilled: 'Buyer found from history',
    pibHint: '9 digits', bankAccountHint: 'e.g. 160-0000000000000-00',
    proUpsell: 'Want more features?',
    proFeatures: 'No limits \u00b7 no watermark \u00b7 history \u00b7 e-Signature',
    proAction: 'Try Pro',
    limitReachedAnon: 'You have reached the free limit of 3 invoices per month.',
    limitReachedFree: 'You have reached the limit of 10 invoices per month.',
    limitCtaAnon: 'Create an account for 10 invoices per month',
    limitCtaPro: 'Upgrade to Pro for unlimited invoices',
  },
  ru: {
    seller: 'Продавец', buyer: 'Покупатель', items: 'Позиции', details: 'Детали',
    preview: 'Предпросмотр', form: 'Форма', generate: 'Создать счёт',
    downloadPdf: 'Скачать PDF', downloadXml: 'Скачать XML',
    invoiceNumber: 'Номер счёта', issueDate: 'Дата выставления',
    deliveryDate: 'Дата доставки', dueDate: 'Срок оплаты',
    paymentReference: 'Основание платежа', paymentRefAuto: 'авто из номера счёта', notes: 'Примечания',
    description: 'Описание', quantity: 'Кол.', unit: 'Ед.',
    unitPrice: 'Цена', vatRate: 'НДС %', amount: 'Сумма',
    addItem: '+ Добавить', removeItem: 'Удалить',
    pib: 'ПИБ', companyName: 'Название', address: 'Адрес',
    city: 'Город', bankAccount: 'Счёт', bankName: 'Банк',
    vatRegistered: 'В системе НДС', editCompany: 'Изменить данные',
    saveBuyer: 'Сохранить', validFields: 'полей заполнено',
    generating: 'Генерация...', success: 'Счёт создан!',
    error: 'Ошибка', mb: 'Матичный номер',
    subtotal: 'Основа', vat: 'НДС', total: 'Итого',
    days7: '7 дней', days15: '15 дней', days30: '30 дней', days60: '60 дней',
    quickSelect: 'Быстрый выбор',
    currency: 'RSD', postalCode: 'Индекс', country: 'Страна',
    buyerAutoFilled: 'Покупатель найден в истории',
    pibHint: '9 цифр', bankAccountHint: 'напр. 160-0000000000000-00',
    proUpsell: 'Хотите больше возможностей?',
    proFeatures: 'Без лимита \u00b7 без žiga \u00b7 история \u00b7 е-Подпис',
    proAction: 'Попробовать Pro',
    limitReachedAnon: 'Вы достигли бесплатного лимита — 3 счёта в месяц.',
    limitReachedFree: 'Вы достигли лимита — 10 счетов в месяц.',
    limitCtaAnon: 'Создайте аккаунт для 10 счетов в месяц',
    limitCtaPro: 'Перейдите на Pro для безлимита',
  },
};

// ── localStorage helpers ──────────────────────────────────────────────────────

interface SavedBuyer { name: string; address: string; city: string }
interface SavedItem { description: string; unit: string; unitPrice: number; vatRate: number }

function loadSavedBuyers(): Record<string, SavedBuyer> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem('efaktura-buyers') || '{}'); } catch { return {}; }
}

function persistBuyer(pib: string, buyer: BuyerData) {
  try {
    const all = loadSavedBuyers();
    all[pib] = { name: buyer.name, address: buyer.address, city: buyer.city };
    localStorage.setItem('efaktura-buyers', JSON.stringify(all));
  } catch {}
}

function loadSavedItems(): SavedItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('efaktura-items') || '[]'); } catch { return []; }
}

function persistItems(items: InvoiceData['items']) {
  try {
    const saved = loadSavedItems();
    for (const item of items) {
      if (!item.description?.trim()) continue;
      const entry: SavedItem = { description: item.description, unit: item.unit, unitPrice: item.unitPrice, vatRate: item.vatRate };
      const idx = saved.findIndex(s => s.description === item.description);
      if (idx >= 0) saved[idx] = entry; else saved.unshift(entry);
    }
    localStorage.setItem('efaktura-items', JSON.stringify(saved.slice(0, 50)));
  } catch {}
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_FIELD'; path: string; value: any }
  | { type: 'SET_SELLER_FIELD'; field: string; value: any }
  | { type: 'SET_BUYER_FIELD'; field: string; value: any }
  | { type: 'SET_BUYER'; buyer: BuyerData }
  | { type: 'SET_ITEM_FIELD'; index: number; field: string; value: any }
  | { type: 'ADD_ITEM' }
  | { type: 'REMOVE_ITEM'; index: number }
  | { type: 'LOAD'; data: InvoiceData };

function reducer(state: InvoiceData, action: Action): InvoiceData {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.path]: action.value };
    case 'SET_SELLER_FIELD':
      return { ...state, seller: { ...state.seller, [action.field]: action.value } };
    case 'SET_BUYER_FIELD':
      return { ...state, buyer: { ...state.buyer, [action.field]: action.value } };
    case 'SET_BUYER':
      return { ...state, buyer: action.buyer };
    case 'SET_ITEM_FIELD': {
      const items = [...state.items];
      items[action.index] = { ...items[action.index], [action.field]: action.value };
      return { ...state, items };
    }
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'kom', unitPrice: 0, vatRate: 20 }],
      };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((_, i) => i !== action.index) };
    case 'LOAD':
      return action.data;
    default:
      return state;
  }
}

function countValid(data: InvoiceData): { valid: number; total: number } {
  const total = 8;
  let valid = 0;
  if (data.invoiceNumber?.trim()) valid++;
  if (data.seller?.name?.trim()) valid++;
  if (data.seller?.pib && /^\d{9}$/.test(data.seller.pib)) valid++;
  if (data.buyer?.name?.trim()) valid++;
  if (data.buyer?.pib && /^\d{9}$/.test(data.buyer.pib)) valid++;
  if (data.issueDate) valid++;
  if (data.dueDate) valid++;
  if (data.items?.length > 0 && data.items.some(i => i.description?.trim())) valid++;
  return { valid, total };
}

function getMissingFields(data: InvoiceData, t: Record<string, string>): string[] {
  const missing: string[] = [];
  if (!data.invoiceNumber?.trim()) missing.push(t.invoiceNumber);
  if (!data.seller?.name?.trim()) missing.push(`${t.seller}: ${t.companyName}`);
  if (!data.seller?.pib || !/^\d{9}$/.test(data.seller.pib)) missing.push(`${t.seller}: ${t.pib}`);
  if (!data.buyer?.name?.trim()) missing.push(`${t.buyer}: ${t.companyName}`);
  if (!data.buyer?.pib || !/^\d{9}$/.test(data.buyer.pib)) missing.push(`${t.buyer}: ${t.pib}`);
  if (!data.issueDate) missing.push(t.issueDate);
  if (!data.dueDate) missing.push(t.dueDate);
  if (!data.items?.length || !data.items.some(i => i.description?.trim())) missing.push(t.items);
  return missing;
}

function trackEvent(event: string, data?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, data);
    }
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Studio({ locale, apiUrl }: Props) {
  const t = translations[locale] || translations.sr;

  useEffect(() => { trackEvent('efaktura_studio_open', { locale }); }, []);

  const [invoice, dispatch] = useReducer(reducer, null, () => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('efaktura-seller') : null;
    const empty = createEmptyInvoice();
    if (saved) {
      try { empty.seller = JSON.parse(saved); } catch {}
    }
    return empty;
  });

  const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'ready' | 'error' | 'limit_anon' | 'limit_free'>('idle');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [downloadData, setDownloadData] = useState<{ pdf: string; xml: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [editingSeller, setEditingSeller] = useState(false);

  // Buyer auto-fill flash
  const [buyerFlash, setBuyerFlash] = useState(false);

  // Item autocomplete
  const [itemSuggestions, setItemSuggestions] = useState<Record<number, SavedItem[]>>({});
  const autocompleteRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { valid, total } = countValid(invoice);

  // Save seller to localStorage on change
  useEffect(() => {
    if (invoice.seller.pib || invoice.seller.name) {
      localStorage.setItem('efaktura-seller', JSON.stringify(invoice.seller));
    }
  }, [invoice.seller]);

  // Auto-generate payment reference
  useEffect(() => {
    if (invoice.invoiceNumber) {
      const ref = generatePaymentReference(invoice.invoiceNumber);
      dispatch({ type: 'SET_FIELD', path: 'paymentReference', value: ref });
    }
  }, [invoice.invoiceNumber]);

  // Close autocomplete on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const hasOpen = Object.keys(itemSuggestions).some(k => (itemSuggestions as any)[k]?.length > 0);
      if (!hasOpen) return;
      const target = e.target as Node;
      const clickedInside = Object.values(autocompleteRefs.current).some(ref => ref?.contains(target));
      if (!clickedInside) setItemSuggestions({});
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [itemSuggestions]);

  // Buyer PIB lookup
  function handleBuyerPibChange(val: string) {
    dispatch({ type: 'SET_BUYER_FIELD', field: 'pib', value: val });
    if (val.length === 9) {
      const saved = loadSavedBuyers();
      if (saved[val]) {
        dispatch({ type: 'SET_BUYER', buyer: { ...invoice.buyer, pib: val, ...saved[val] } });
        setBuyerFlash(true);
        setTimeout(() => setBuyerFlash(false), 1500);
      }
    }
  }

  // Item description autocomplete
  function handleItemDescriptionChange(idx: number, val: string) {
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'description', value: val });
    if (val.trim().length >= 1) {
      const saved = loadSavedItems();
      const lower = val.toLowerCase();
      const matches = saved.filter(s => s.description.toLowerCase().includes(lower)).slice(0, 6);
      setItemSuggestions(prev => ({ ...prev, [idx]: matches }));
    } else {
      setItemSuggestions(prev => ({ ...prev, [idx]: [] }));
    }
  }

  function applyItemSuggestion(idx: number, suggestion: SavedItem) {
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'description', value: suggestion.description });
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unit', value: suggestion.unit });
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unitPrice', value: suggestion.unitPrice });
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'vatRate', value: suggestion.vatRate });
    setItemSuggestions(prev => ({ ...prev, [idx]: [] }));
  }

  const handleGenerate = async () => {
    setGenStatus('generating');
    trackEvent('efaktura_generate_start', { locale, items: invoice.items.length });
    try {
      const createRes = await fetch(`${apiUrl}/api/efaktura/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        if (createRes.status === 429 && err.error?.includes('3 invoices')) {
          setGenStatus('limit_anon');
          return;
        }
        if (createRes.status === 429 && err.error?.includes('10 invoices')) {
          setGenStatus('limit_free');
          return;
        }
        throw new Error(err.error || 'Failed to create invoice');
      }
      const { id } = await createRes.json();
      setInvoiceId(id);

      const genRes = await fetch(`${apiUrl}/api/efaktura/invoices/${id}/generate`, { method: 'POST' });
      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || 'Failed to generate');
      }

      let attempts = 0;
      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`${apiUrl}/api/efaktura/invoices/${id}/status`);
        const status = await statusRes.json();
        if (status.status === 'ready') {
          const dlRes = await fetch(`${apiUrl}/api/efaktura/invoices/${id}/download`);
          const dlData = await dlRes.json();
          setDownloadData(dlData);
          setGenStatus('ready');
          trackEvent('efaktura_generate_success', { locale });
          // Save buyer and items to localStorage for future auto-fill
          if (invoice.buyer.pib && /^\d{9}$/.test(invoice.buyer.pib) && invoice.buyer.name) {
            persistBuyer(invoice.buyer.pib, invoice.buyer);
          }
          persistItems(invoice.items);
          return;
        }
        if (status.status === 'error') {
          throw new Error(status.errorMessage || 'Generation failed');
        }
        attempts++;
      }
      throw new Error('Timeout waiting for generation');
    } catch (err: any) {
      setGenStatus('error');
      console.error('Generation error:', err);
    }
  };

  const downloadFile = (base64: string, filename: string, mime: string) => {
    trackEvent('efaktura_download', { locale, type: mime.includes('pdf') ? 'pdf' : 'xml' });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = 'w-full bg-bg-alt border border-border-light rounded px-3 py-2 text-text text-sm focus:outline-none focus:border-primary transition-colors';
  const inputError = 'w-full bg-bg-alt border border-red-500/50 rounded px-3 py-2 text-text text-sm focus:outline-none focus:border-red-500 transition-colors';
  const inputValid = 'w-full bg-bg-alt border border-green-500/50 rounded px-3 py-2 text-text text-sm focus:outline-none focus:border-green-500 transition-colors';
  const labelClass = 'block text-text-muted text-xs mb-1';
  const sectionClass = 'bg-bg-card rounded-lg p-4 mb-4';

  // PIB validation helper: empty=neutral, 9 digits=valid, 1-8=error
  function pibClass(val: string | undefined): string {
    if (!val || val.length === 0) return inputClass;
    return /^\d{9}$/.test(val) ? inputValid : inputError;
  }

  // Bank account: 18 digits (with or without dashes)
  function bankClass(val: string | undefined): string {
    if (!val || val.length === 0) return inputClass;
    const digits = val.replace(/\D/g, '');
    return digits.length === 18 ? inputValid : (digits.length > 0 ? inputError : inputClass);
  }

  // Format bank account with dashes: XXX-XXXXXXXXXXXXX-XX
  function formatBankAccount(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 16) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits.slice(0, 3) + '-' + digits.slice(3, 16) + '-' + digits.slice(16, 18);
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Mobile tab bar */}
      <div className="md:hidden flex border-b border-border sticky top-0 bg-bg z-10">
        <button
          onClick={() => setMobileTab('form')}
          className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
            mobileTab === 'form' ? 'text-primary border-b-2 border-primary' : 'text-text-muted'
          }`}
        >
          {t.form}
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
            mobileTab === 'preview' ? 'text-primary border-b-2 border-primary' : 'text-text-muted'
          }`}
        >
          {t.preview}
        </button>
      </div>

      {/* Desktop: split screen */}
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Left panel - Form */}
        <div className={`w-full md:w-[55%] p-4 md:p-6 overflow-y-auto md:h-screen ${
          mobileTab !== 'form' ? 'hidden md:block' : ''
        }`}>
          {/* Invoice number */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-text font-semibold">{t.invoiceNumber}</h2>
            </div>
            <input
              type="text"
              className={inputClass}
              placeholder="001/2026"
              value={invoice.invoiceNumber}
              onChange={e => dispatch({ type: 'SET_FIELD', path: 'invoiceNumber', value: e.target.value })}
            />
          </div>

          {/* Seller */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-text font-semibold">{t.seller}</h2>
              <button
                onClick={() => setEditingSeller(!editingSeller)}
                className="text-primary text-xs hover:underline"
              >
                {t.editCompany}
              </button>
            </div>
            {editingSeller ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t.companyName} *</label>
                  <input className={inputClass} value={invoice.seller.name}
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'name', value: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>{t.pib} * <span className="text-text-muted/60">({t.pibHint})</span></label>
                  <input className={pibClass(invoice.seller.pib)} value={invoice.seller.pib} maxLength={9}
                    placeholder="123456789"
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'pib', value: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div>
                  <label className={labelClass}>{t.address}</label>
                  <input className={inputClass} value={invoice.seller.address}
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'address', value: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>{t.city}</label>
                  <input className={inputClass} value={invoice.seller.city}
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'city', value: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>{t.mb}</label>
                  <input className={inputClass} value={invoice.seller.mb || ''}
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'mb', value: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>{t.bankAccount} <span className="text-text-muted/60">({t.bankAccountHint})</span></label>
                  <input className={bankClass(invoice.seller.bankAccount)} value={invoice.seller.bankAccount || ''}
                    placeholder="160-0000000000000-00" maxLength={20}
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'bankAccount', value: formatBankAccount(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>{t.bankName}</label>
                  <input className={inputClass} value={invoice.seller.bankName || ''}
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'bankName', value: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-text text-sm cursor-pointer">
                    <input type="checkbox" checked={invoice.seller.vatRegistered}
                      onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'vatRegistered', value: e.target.checked })}
                      className="rounded" />
                    {t.vatRegistered}
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-text-light text-sm">
                {invoice.seller.name ? (
                  <>
                    <p className="font-medium text-text">{invoice.seller.name}</p>
                    {invoice.seller.address && <p>{invoice.seller.address}, {invoice.seller.city}</p>}
                    {invoice.seller.pib && <p>PIB: {invoice.seller.pib}</p>}
                    {invoice.seller.bankAccount && <p>Račun: {invoice.seller.bankAccount}</p>}
                  </>
                ) : (
                  <p className="text-text-muted italic">{t.editCompany}</p>
                )}
              </div>
            )}
          </div>

          {/* Buyer */}
          <div className={`${sectionClass} transition-all duration-300 ${buyerFlash ? 'ring-2 ring-green-500 ring-opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-text font-semibold">{t.buyer}</h2>
              {buyerFlash && (
                <span className="text-green-400 text-xs font-medium animate-pulse">
                  ✓ {t.buyerAutoFilled}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t.pib} <span className="text-text-muted/60">({t.pibHint})</span></label>
                <input
                  className={buyerFlash ? inputValid : pibClass(invoice.buyer.pib)}
                  value={invoice.buyer.pib || ''}
                  maxLength={9}
                  placeholder="123456789"
                  onChange={e => handleBuyerPibChange(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <label className={labelClass}>{t.companyName} *</label>
                <input className={inputClass} value={invoice.buyer.name}
                  onChange={e => dispatch({ type: 'SET_BUYER_FIELD', field: 'name', value: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t.address}</label>
                <input className={inputClass} value={invoice.buyer.address}
                  onChange={e => dispatch({ type: 'SET_BUYER_FIELD', field: 'address', value: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t.city}</label>
                <input className={inputClass} value={invoice.buyer.city}
                  onChange={e => dispatch({ type: 'SET_BUYER_FIELD', field: 'city', value: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className={sectionClass}>
            <h2 className="text-text font-semibold mb-3">{t.items}</h2>
            <div className="space-y-3">
              {invoice.items.map((item, idx) => (
                <div key={item.id} className="bg-bg-alt rounded-lg p-3 relative">
                  {invoice.items.length > 1 && (
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_ITEM', index: idx })}
                      className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                  {/* Description with autocomplete */}
                  <div className="mb-2 relative" ref={el => { autocompleteRefs.current[idx] = el; }}>
                    <input
                      className={inputClass}
                      placeholder={t.description}
                      value={item.description}
                      onChange={e => handleItemDescriptionChange(idx, e.target.value)}
                      onFocus={() => {
                        if (item.description.trim().length >= 1) {
                          const saved = loadSavedItems();
                          const lower = item.description.toLowerCase();
                          const matches = saved.filter(s => s.description.toLowerCase().includes(lower)).slice(0, 6);
                          setItemSuggestions(prev => ({ ...prev, [idx]: matches }));
                        }
                      }}
                      autoComplete="off"
                    />
                    {itemSuggestions[idx] && itemSuggestions[idx].length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-bg-card border border-border-light rounded-lg shadow-lg z-20 overflow-hidden">
                        {itemSuggestions[idx].map((s, si) => (
                          <button
                            key={si}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-bg-alt transition-colors flex items-center justify-between gap-2"
                            onMouseDown={e => { e.preventDefault(); applyItemSuggestion(idx, s); }}
                          >
                            <span className="text-text truncate">{s.description}</span>
                            <span className="text-text-muted text-xs whitespace-nowrap shrink-0">
                              {s.unitPrice.toLocaleString('sr-Latn-RS')} RSD / {s.unit}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className={labelClass}>{t.quantity}</label>
                      <input type="number" step="0.01" min="0" className={inputClass}
                        value={item.quantity || ''}
                        placeholder="1"
                        onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'quantity', value: parseFloat(e.target.value) || 0 })}
                        onBlur={e => { if (!e.target.value) dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'quantity', value: 1 }); }} />
                    </div>
                    <div>
                      <label className={labelClass}>{t.unit}</label>
                      <select className={inputClass} value={item.unit}
                        onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unit', value: e.target.value })}>
                        <option value="kom">kom</option>
                        <option value="kg">kg</option>
                        <option value="m">m</option>
                        <option value="l">l</option>
                        <option value="h">h</option>
                        <option value="dan">dan</option>
                        <option value="km">km</option>
                        <option value="paket">paket</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t.unitPrice}</label>
                      <input type="number" step="0.01" min="0" className={inputClass}
                        value={item.unitPrice || ''}
                        placeholder="0.00"
                        onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unitPrice', value: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className={labelClass}>{t.vatRate}</label>
                      <select className={inputClass} value={item.vatRate}
                        onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'vatRate', value: parseInt(e.target.value) })}>
                        <option value="20">20%</option>
                        <option value="10">10%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => dispatch({ type: 'ADD_ITEM' })}
              className="mt-3 text-primary text-sm hover:underline"
            >
              {t.addItem}
            </button>
          </div>

          {/* Details (collapsible) */}
          <div className={sectionClass}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-text font-semibold w-full text-left flex items-center justify-between"
            >
              <span>{t.details}</span>
              <span className={`transform transition-transform ${showDetails ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {showDetails && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={labelClass}>{t.issueDate}</label>
                  <input type="date" className={inputClass} value={invoice.issueDate}
                    onChange={e => dispatch({ type: 'SET_FIELD', path: 'issueDate', value: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>{t.deliveryDate}</label>
                  <input type="date" className={inputClass} value={invoice.deliveryDate || ''}
                    onChange={e => dispatch({ type: 'SET_FIELD', path: 'deliveryDate', value: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>{t.dueDate}</label>
                  <input type="date" className={inputClass} value={invoice.dueDate}
                    onChange={e => dispatch({ type: 'SET_FIELD', path: 'dueDate', value: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>{t.quickSelect}</label>
                  <div className="flex gap-1">
                    {[7, 15, 30, 60].map(days => (
                      <button key={days}
                        onClick={() => {
                          const d = new Date(invoice.issueDate || Date.now());
                          d.setDate(d.getDate() + days);
                          dispatch({ type: 'SET_FIELD', path: 'dueDate', value: d.toISOString().split('T')[0] });
                        }}
                        className="px-2 py-1 text-xs bg-bg-alt border border-border-light rounded text-text-muted hover:text-primary hover:border-primary transition-colors"
                      >
                        {(t as any)[`days${days}`]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t.paymentReference} <span className="text-text-muted/60">({t.paymentRefAuto})</span></label>
                  <input className={inputClass} value={invoice.paymentReference || ''}
                    placeholder={t.paymentRefAuto}
                    onChange={e => dispatch({ type: 'SET_FIELD', path: 'paymentReference', value: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>{t.notes}</label>
                  <textarea className={inputClass + ' h-20 resize-none'} value={invoice.notes || ''}
                    onChange={e => dispatch({ type: 'SET_FIELD', path: 'notes', value: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-bg border-t border-border p-4 -mx-4 md:-mx-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-bg-alt rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(valid / total) * 100}%` }}
                />
              </div>
              <span className="text-text-muted text-xs whitespace-nowrap">{valid}/{total} {t.validFields}</span>
            </div>
            {valid > 0 && valid < total && (
              <div className="flex flex-wrap gap-1 mb-2">
                {getMissingFields(invoice, t).map((f, i) => (
                  <span key={i} className="text-red-400/80 text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
            )}

            {genStatus === 'ready' && downloadData ? (
              <div className="space-y-2">
                <p className="text-green-400 text-sm font-medium text-center">{t.success}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadFile(downloadData.pdf, `Faktura-${invoice.invoiceNumber}.pdf`, 'application/pdf')}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {t.downloadPdf}
                  </button>
                  <button
                    onClick={() => downloadFile(downloadData.xml, `eFaktura-${invoice.invoiceNumber}.xml`, 'application/xml')}
                    className="flex-1 bg-accent hover:bg-accent-dark text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {t.downloadXml}
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-border-light text-center">
                  <p className="text-text-muted text-xs mb-1">{t.proUpsell}</p>
                  <p className="text-text-muted text-[10px] mb-2">{t.proFeatures}</p>
                  <a
                    href="https://app.echain.world"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-1.5 text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors"
                  >
                    {t.proAction}
                  </a>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={genStatus === 'generating' || genStatus === 'limit_anon' || genStatus === 'limit_free' || valid < total}
                className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                  genStatus === 'generating'
                    ? 'bg-gray-600 cursor-wait'
                    : genStatus === 'limit_anon' || genStatus === 'limit_free'
                    ? 'bg-gray-700 cursor-not-allowed opacity-50'
                    : valid < total
                    ? 'bg-gray-700 cursor-not-allowed opacity-50'
                    : 'bg-primary hover:bg-primary-dark'
                }`}
              >
                {genStatus === 'generating' ? t.generating : t.generate}
              </button>
            )}
            {genStatus === 'error' && (
              <p className="text-red-400 text-sm text-center mt-2">{t.error}</p>
            )}
            {genStatus === 'limit_anon' && (
              <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center space-y-2">
                <p className="text-orange-400 text-sm font-medium">{t.limitReachedAnon}</p>
                <a
                  href="https://app.echain.world"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-1.5 text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors"
                >
                  {t.limitCtaAnon}
                </a>
              </div>
            )}
            {genStatus === 'limit_free' && (
              <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center space-y-2">
                <p className="text-orange-400 text-sm font-medium">{t.limitReachedFree}</p>
                <a
                  href="https://app.echain.world"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-1.5 text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors"
                >
                  {t.limitCtaPro}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className={`w-full md:w-[45%] bg-gray-900 p-4 md:p-6 overflow-y-auto md:h-screen ${
          mobileTab !== 'preview' ? 'hidden md:block' : ''
        }`}>
          <div className="max-w-[210mm] mx-auto shadow-2xl">
            <InvoicePreview data={invoice} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}
