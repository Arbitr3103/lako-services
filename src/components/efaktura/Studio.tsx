import { useReducer, useState, useEffect } from 'react';
import InvoicePreview from './InvoicePreview';
import type { InvoiceData } from './types';
import { createEmptyInvoice, generatePaymentReference, computeTotals } from './types';

interface Props {
  locale: string;
  apiUrl: string;
}

const translations: Record<string, Record<string, string>> = {
  sr: {
    seller: 'Prodavac', buyer: 'Kupac', items: 'Stavke', details: 'Detalji',
    preview: 'Pregled', form: 'Forma', generate: 'Generi\u0161i fakturu',
    downloadPdf: 'Preuzmi PDF', downloadXml: 'Preuzmi XML',
    invoiceNumber: 'Broj fakture', issueDate: 'Datum izdavanja',
    deliveryDate: 'Datum isporuke', dueDate: 'Rok pla\u0107anja',
    paymentReference: 'Poziv na broj', notes: 'Napomene',
    description: 'Opis', quantity: 'Kol.', unit: 'Jed.',
    unitPrice: 'Cena', vatRate: 'PDV %', amount: 'Iznos',
    addItem: '+ Dodaj stavku', removeItem: 'Obri\u0161i',
    pib: 'PIB', companyName: 'Naziv firme', address: 'Adresa',
    city: 'Grad', bankAccount: 'Teku\u0107i ra\u010dun', bankName: 'Banka',
    vatRegistered: 'U sistemu PDV', editCompany: 'Izmeni podatke firme',
    saveBuyer: 'Sa\u010duvaj kupca', validFields: 'polja validno',
    generating: 'Generisanje...', success: 'Faktura uspe\u0161no generisana!',
    error: 'Gre\u0161ka pri generisanju', mb: 'Mati\u010dni broj',
    subtotal: 'Osnovica', vat: 'PDV', total: 'Ukupno',
    days7: '7 dana', days15: '15 dana', days30: '30 dana', days60: '60 dana',
    currency: 'RSD', postalCode: 'Po\u0161tanski broj', country: 'Dr\u017eava',
  },
  en: {
    seller: 'Seller', buyer: 'Buyer', items: 'Items', details: 'Details',
    preview: 'Preview', form: 'Form', generate: 'Generate invoice',
    downloadPdf: 'Download PDF', downloadXml: 'Download XML',
    invoiceNumber: 'Invoice number', issueDate: 'Issue date',
    deliveryDate: 'Delivery date', dueDate: 'Due date',
    paymentReference: 'Payment reference', notes: 'Notes',
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
    currency: 'RSD', postalCode: 'Postal code', country: 'Country',
  },
  ru: {
    seller: '\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446', buyer: '\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c', items: '\u041f\u043e\u0437\u0438\u0446\u0438\u0438', details: '\u0414\u0435\u0442\u0430\u043b\u0438',
    preview: '\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440', form: '\u0424\u043e\u0440\u043c\u0430', generate: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u0447\u0451\u0442',
    downloadPdf: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c PDF', downloadXml: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c XML',
    invoiceNumber: '\u041d\u043e\u043c\u0435\u0440 \u0441\u0447\u0451\u0442\u0430', issueDate: '\u0414\u0430\u0442\u0430 \u0432\u044b\u0441\u0442\u0430\u0432\u043b\u0435\u043d\u0438\u044f',
    deliveryDate: '\u0414\u0430\u0442\u0430 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438', dueDate: '\u0421\u0440\u043e\u043a \u043e\u043f\u043b\u0430\u0442\u044b',
    paymentReference: '\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u043f\u043b\u0430\u0442\u0451\u0436', notes: '\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u044f',
    description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435', quantity: '\u041a\u043e\u043b.', unit: '\u0415\u0434.',
    unitPrice: '\u0426\u0435\u043d\u0430', vatRate: '\u041d\u0414\u0421 %', amount: '\u0421\u0443\u043c\u043c\u0430',
    addItem: '+ \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c', removeItem: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
    pib: '\u041f\u0418\u0411', companyName: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', address: '\u0410\u0434\u0440\u0435\u0441',
    city: '\u0413\u043e\u0440\u043e\u0434', bankAccount: '\u0421\u0447\u0451\u0442', bankName: '\u0411\u0430\u043d\u043a',
    vatRegistered: '\u0412 \u0441\u0438\u0441\u0442\u0435\u043c\u0435 \u041d\u0414\u0421', editCompany: '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435',
    saveBuyer: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c', validFields: '\u043f\u043e\u043b\u0435\u0439 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u043e',
    generating: '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f...', success: '\u0421\u0447\u0451\u0442 \u0441\u043e\u0437\u0434\u0430\u043d!',
    error: '\u041e\u0448\u0438\u0431\u043a\u0430', mb: '\u041c\u0430\u0442\u0438\u0447\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440',
    subtotal: '\u041e\u0441\u043d\u043e\u0432\u0430', vat: '\u041d\u0414\u0421', total: '\u0418\u0442\u043e\u0433\u043e',
    days7: '7 \u0434\u043d\u0435\u0439', days15: '15 \u0434\u043d\u0435\u0439', days30: '30 \u0434\u043d\u0435\u0439', days60: '60 \u0434\u043d\u0435\u0439',
    currency: 'RSD', postalCode: '\u0418\u043d\u0434\u0435\u043a\u0441', country: '\u0421\u0442\u0440\u0430\u043d\u0430',
  },
};

type Action =
  | { type: 'SET_FIELD'; path: string; value: any }
  | { type: 'SET_SELLER_FIELD'; field: string; value: any }
  | { type: 'SET_BUYER_FIELD'; field: string; value: any }
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

function trackEvent(event: string, data?: Record<string, any>) {
  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, data);
    }
    // Also fire a beacon for our own analytics
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', JSON.stringify({ event, ...data, ts: Date.now() }));
    }
  } catch {}
}

export default function Studio({ locale, apiUrl }: Props) {
  const t = translations[locale] || translations.sr;

  // Track studio open
  useEffect(() => { trackEvent('efaktura_studio_open', { locale }); }, []);

  const [invoice, dispatch] = useReducer(reducer, null, () => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('efaktura-seller') : null;
    const empty = createEmptyInvoice();
    if (saved) {
      try {
        empty.seller = JSON.parse(saved);
      } catch {}
    }
    return empty;
  });

  const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [downloadData, setDownloadData] = useState<{ pdf: string; xml: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [editingSeller, setEditingSeller] = useState(false);

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
  const labelClass = 'block text-text-muted text-xs mb-1';
  const sectionClass = 'bg-bg-card rounded-lg p-4 mb-4';

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
                  <label className={labelClass}>{t.pib} *</label>
                  <input className={inputClass} value={invoice.seller.pib} maxLength={9}
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
                  <label className={labelClass}>{t.bankAccount}</label>
                  <input className={inputClass} value={invoice.seller.bankAccount || ''}
                    onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'bankAccount', value: e.target.value })} />
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
                    {invoice.seller.bankAccount && <p>Ra\u010dun: {invoice.seller.bankAccount}</p>}
                  </>
                ) : (
                  <p className="text-text-muted italic">{t.editCompany}</p>
                )}
              </div>
            )}
          </div>

          {/* Buyer */}
          <div className={sectionClass}>
            <h2 className="text-text font-semibold mb-3">{t.buyer}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t.pib}</label>
                <input className={inputClass} value={invoice.buyer.pib || ''} maxLength={9}
                  onChange={e => dispatch({ type: 'SET_BUYER_FIELD', field: 'pib', value: e.target.value.replace(/\D/g, '') })} />
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
                      {'\u2715'}
                    </button>
                  )}
                  <div className="mb-2">
                    <input
                      className={inputClass}
                      placeholder={t.description}
                      value={item.description}
                      onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'description', value: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className={labelClass}>{t.quantity}</label>
                      <input type="number" step="0.01" min="0" className={inputClass}
                        value={item.quantity}
                        onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'quantity', value: parseFloat(e.target.value) || 0 })} />
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
                        value={item.unitPrice}
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
              <span className={`transform transition-transform ${showDetails ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
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
                  <label className={labelClass}>Quick select</label>
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
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t.paymentReference}</label>
                  <input className={inputClass} value={invoice.paymentReference || ''} readOnly
                    title="Auto-generated from invoice number" />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>{t.notes}</label>
                  <textarea className={inputClass + ' h-20 resize-none'} value={invoice.notes || ''}
                    onChange={e => dispatch({ type: 'SET_FIELD', path: 'notes', value: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer with validation + generate button */}
          <div className="sticky bottom-0 bg-bg border-t border-border p-4 -mx-4 md:-mx-6">
            {/* Validation progress */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-bg-alt rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(valid / total) * 100}%` }}
                />
              </div>
              <span className="text-text-muted text-xs whitespace-nowrap">{valid}/{total} {t.validFields}</span>
            </div>

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
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={genStatus === 'generating' || valid < total}
                className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                  genStatus === 'generating'
                    ? 'bg-gray-600 cursor-wait'
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
