import { useReducer, useState, useEffect, useRef } from 'react';
import InvoicePreview from './InvoicePreview';
import type { InvoiceData } from './types';
import { createEmptyInvoice, generatePaymentReference } from './types';
import { countValid, getMissingFields } from './validation';
import {
  inputClass,
  sectionClass,
  type Action,
  type StudioT,
} from './form/shared';
import SellerSection from './form/SellerSection';
import BuyerSection from './form/BuyerSection';
import ItemsSection from './form/ItemsSection';
import TransportSection from './form/TransportSection';
import SignaturesSection from './form/SignaturesSection';
import DetailsSection from './form/DetailsSection';
import {
  clearSavedEfakturaData,
  hasStorageConsent,
  loadSavedBuyers,
  loadSavedItems,
  loadSavedSeller,
  persistBuyer,
  persistItems,
  persistSeller,
  setStorageConsent,
  type SavedItem,
} from './storage';

interface Props {
  locale: string;
  apiUrl: string;
  /** Dictionary from i18n `efakturaStudio`, resolved server-side in the .astro page
   * so the client island does not bundle the full site translations. */
  translations: StudioT;
}

// ── Reducer ───────────────────────────────────────────────────────────────────

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
    case 'SET_DOCUMENT_TYPE':
      return { ...state, documentType: action.documentType };
    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const ALLOWED_API_HOSTS = ['https://bot.lako.services'];
const API_FETCH_TIMEOUT_MS = 15_000;

export default function Studio({ locale, apiUrl, translations: t }: Props) {

  const [invoice, dispatch] = useReducer(reducer, null, () => {
    const empty = createEmptyInvoice();
    const savedSeller = loadSavedSeller();
    if (savedSeller) empty.seller = savedSeller;
    return empty;
  });

  const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'ready' | 'error' | 'limit_anon' | 'limit_free'>('idle');
  const [downloadData, setDownloadData] = useState<{ pdf: string; xml: string | null } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [editingSeller, setEditingSeller] = useState(false);
  const [storageEnabled, setStorageEnabled] = useState(() => hasStorageConsent());

  // Buyer auto-fill flash
  const [buyerFlash, setBuyerFlash] = useState(false);

  // Item autocomplete
  const [itemSuggestions, setItemSuggestions] = useState<Record<number, SavedItem[]>>({});
  const autocompleteRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { valid, total } = countValid(invoice);

  // Save seller locally only after explicit device-level opt-in.
  useEffect(() => {
    if (storageEnabled && (invoice.seller.pib || invoice.seller.name)) {
      persistSeller(invoice.seller);
    }
  }, [invoice.seller, storageEnabled]);

  // Auto-generate payment reference (faktura only)
  useEffect(() => {
    if (invoice.invoiceNumber && invoice.documentType !== 'otpremnica') {
      const ref = generatePaymentReference(invoice.invoiceNumber);
      dispatch({ type: 'SET_FIELD', path: 'paymentReference', value: ref });
    }
  }, [invoice.invoiceNumber, invoice.documentType]);

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

  // After all hooks so the hook order never changes between renders
  if (!ALLOWED_API_HOSTS.includes(apiUrl)) {
    return <div>Configuration error: invalid API URL</div>;
  }

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

  function handleItemDescriptionFocus(idx: number) {
    const item = invoice.items[idx];
    if (item && item.description.trim().length >= 1) {
      const saved = loadSavedItems();
      const lower = item.description.toLowerCase();
      const matches = saved.filter(s => s.description.toLowerCase().includes(lower)).slice(0, 6);
      setItemSuggestions(prev => ({ ...prev, [idx]: matches }));
    }
  }

  function applyItemSuggestion(idx: number, suggestion: SavedItem) {
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'description', value: suggestion.description });
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unit', value: suggestion.unit });
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unitPrice', value: suggestion.unitPrice });
    dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'vatRate', value: suggestion.vatRate });
    setItemSuggestions(prev => ({ ...prev, [idx]: [] }));
  }

  function handleStorageToggle(enabled: boolean) {
    setStorageConsent(enabled);
    setStorageEnabled(enabled);
    setItemSuggestions({});
    if (enabled && (invoice.seller.pib || invoice.seller.name)) {
      persistSeller(invoice.seller);
    }
  }

  function handleClearSavedData() {
    clearSavedEfakturaData();
    setStorageEnabled(false);
    setItemSuggestions({});
  }

  const handleGenerate = async () => {
    setGenStatus('generating');
    try {
      const createRes = await fetch(`${apiUrl}/api/efaktura/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
        signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        // Prefer a machine-readable code; fall back to matching the error text
        if (createRes.status === 429 && (err.code === 'LIMIT_ANON' || err.error?.includes('3 invoices'))) {
          setGenStatus('limit_anon');
          return;
        }
        if (createRes.status === 429 && (err.code === 'LIMIT_FREE' || err.error?.includes('10 invoices'))) {
          setGenStatus('limit_free');
          return;
        }
        throw new Error(err.error || 'Failed to create invoice');
      }
      const { id } = await createRes.json();

      const genRes = await fetch(`${apiUrl}/api/efaktura/invoices/${id}/generate`, {
        method: 'POST',
        signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate');
      }

      let attempts = 0;
      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`${apiUrl}/api/efaktura/invoices/${id}/status`, {
          signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
        });
        const status = await statusRes.json();
        if (status.status === 'ready') {
          const dlRes = await fetch(`${apiUrl}/api/efaktura/invoices/${id}/download`, {
            signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
          });
          const dlData = await dlRes.json();
          setDownloadData(dlData);
          setGenStatus('ready');
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
          {/* Document type toggle */}
          <div className={sectionClass}>
            <div className="flex rounded-lg bg-bg-alt p-1">
              {(['faktura', 'otpremnica'] as const).map(dt => (
                <button
                  key={dt}
                  onClick={() => dispatch({ type: 'SET_DOCUMENT_TYPE', documentType: dt })}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    (invoice.documentType || 'faktura') === dt
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {t[dt]}
                </button>
              ))}
            </div>
          </div>

          {/* Local storage consent */}
          <div className={sectionClass}>
            <div className="flex items-start justify-between gap-3">
              <label className="flex items-start gap-3 text-sm text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={storageEnabled}
                  onChange={e => handleStorageToggle(e.target.checked)}
                  className="mt-0.5 rounded border-border-light text-primary focus:ring-primary"
                />
                <span>
                  <span className="block font-medium">{t.rememberData}</span>
                  <span className="block text-xs text-text-muted mt-0.5">{t.rememberDataHint}</span>
                </span>
              </label>
              <button
                type="button"
                onClick={handleClearSavedData}
                className="text-xs text-text-muted hover:text-red-400 transition-colors shrink-0"
              >
                {t.clearSavedData}
              </button>
            </div>
          </div>

          {/* Document number */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-text font-semibold">
                {invoice.documentType === 'otpremnica' ? t.documentNumber : t.invoiceNumber}
              </h2>
            </div>
            <input
              type="text"
              className={inputClass}
              placeholder={invoice.documentType === 'otpremnica' ? 'O-001/2026' : '001/2026'}
              value={invoice.invoiceNumber}
              maxLength={50}
              onChange={e => dispatch({ type: 'SET_FIELD', path: 'invoiceNumber', value: e.target.value })}
            />
          </div>

          <SellerSection
            t={t}
            seller={invoice.seller}
            editingSeller={editingSeller}
            setEditingSeller={setEditingSeller}
            dispatch={dispatch}
          />

          <BuyerSection
            t={t}
            buyer={invoice.buyer}
            buyerFlash={buyerFlash}
            onBuyerPibChange={handleBuyerPibChange}
            dispatch={dispatch}
          />

          <ItemsSection
            t={t}
            items={invoice.items}
            itemSuggestions={itemSuggestions}
            autocompleteRefs={autocompleteRefs}
            dispatch={dispatch}
            onDescriptionChange={handleItemDescriptionChange}
            onDescriptionFocus={handleItemDescriptionFocus}
            applyItemSuggestion={applyItemSuggestion}
          />

          {/* Transport + signatures (otpremnica only) */}
          {invoice.documentType === 'otpremnica' && (
            <>
              <TransportSection t={t} invoice={invoice} dispatch={dispatch} />
              <SignaturesSection t={t} invoice={invoice} dispatch={dispatch} />
            </>
          )}

          <DetailsSection
            t={t}
            invoice={invoice}
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            dispatch={dispatch}
          />

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
                <p className="text-green-400 text-sm font-medium text-center">
                  {invoice.documentType === 'otpremnica' ? t.successOtpremnica : t.success}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const prefix = invoice.documentType === 'otpremnica' ? 'Otpremnica' : 'Faktura';
                      const safeNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 50);
                      downloadFile(downloadData.pdf, `${prefix}-${safeNumber}.pdf`, 'application/pdf');
                    }}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {t.downloadPdf}
                  </button>
                  {downloadData.xml && (
                    <button
                      onClick={() => {
                        const safeNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 50);
                        downloadFile(downloadData.xml!, `eFaktura-${safeNumber}.xml`, 'application/xml');
                      }}
                      className="flex-1 bg-accent hover:bg-accent-dark text-white py-3 rounded-lg font-medium transition-colors"
                    >
                      {t.downloadXml}
                    </button>
                  )}
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
                {genStatus === 'generating'
                  ? t.generating
                  : invoice.documentType === 'otpremnica' ? t.generateOtpremnica : t.generate}
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
