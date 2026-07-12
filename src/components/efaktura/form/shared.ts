import type { Dispatch } from 'react';
import type { InvoiceData, BuyerData, DocumentType } from '../types';

/** Translation dictionary for the Studio form (from i18n `efakturaStudio`). */
export type StudioT = Record<string, string>;

// ── Reducer action type (reducer itself lives in Studio.tsx) ────────────────────

export type Action =
  | { type: 'SET_FIELD'; path: string; value: any }
  | { type: 'SET_SELLER_FIELD'; field: string; value: any }
  | { type: 'SET_BUYER_FIELD'; field: string; value: any }
  | { type: 'SET_BUYER'; buyer: BuyerData }
  | { type: 'SET_ITEM_FIELD'; index: number; field: string; value: any }
  | { type: 'ADD_ITEM' }
  | { type: 'REMOVE_ITEM'; index: number }
  | { type: 'LOAD'; data: InvoiceData }
  | { type: 'SET_DOCUMENT_TYPE'; documentType: DocumentType };

export type StudioDispatch = Dispatch<Action>;

// ── Shared field styling ────────────────────────────────────────────────────────

export const inputClass = 'w-full bg-bg-alt border border-border-light rounded px-3 py-2 text-text text-sm focus:outline-none focus:border-primary transition-colors';
export const inputError = 'w-full bg-bg-alt border border-red-500/50 rounded px-3 py-2 text-text text-sm focus:outline-none focus:border-red-500 transition-colors';
export const inputValid = 'w-full bg-bg-alt border border-green-500/50 rounded px-3 py-2 text-text text-sm focus:outline-none focus:border-green-500 transition-colors';
export const labelClass = 'block text-text-muted text-xs mb-1';
export const sectionClass = 'bg-bg-card rounded-lg p-4 mb-4';

// ── Validation helpers ──────────────────────────────────────────────────────────

// PIB validation helper: empty=neutral, 9 digits=valid, 1-8=error
export function pibClass(val: string | undefined): string {
  if (!val || val.length === 0) return inputClass;
  return /^\d{9}$/.test(val) ? inputValid : inputError;
}

// Bank account: 18 digits (with or without dashes)
export function bankClass(val: string | undefined): string {
  if (!val || val.length === 0) return inputClass;
  const digits = val.replace(/\D/g, '');
  return digits.length === 18 ? inputValid : (digits.length > 0 ? inputError : inputClass);
}

// Format bank account with dashes: XXX-XXXXXXXXXXXXX-XX
export function formatBankAccount(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 16) return digits.slice(0, 3) + '-' + digits.slice(3);
  return digits.slice(0, 3) + '-' + digits.slice(3, 16) + '-' + digits.slice(16, 18);
}
