import type { InvoiceData } from './types';

/**
 * Required fields per document type:
 * faktura    — number, seller name, seller PIB, buyer name, buyer PIB, issue date, due date, items (8)
 * otpremnica — same without due date (7)
 */
export function countValid(data: InvoiceData): { valid: number; total: number } {
  const isOtpremnica = data.documentType === 'otpremnica';
  const total = isOtpremnica ? 7 : 8;
  let valid = 0;
  if (data.invoiceNumber?.trim()) valid++;
  if (data.seller?.name?.trim()) valid++;
  if (data.seller?.pib && /^\d{9}$/.test(data.seller.pib)) valid++;
  if (data.buyer?.name?.trim()) valid++;
  if (data.buyer?.pib && /^\d{9}$/.test(data.buyer.pib)) valid++;
  if (data.issueDate) valid++;
  if (!isOtpremnica && data.dueDate) valid++;
  if (data.items?.length > 0 && data.items.some(i => i.description?.trim())) valid++;
  return { valid, total };
}

export function getMissingFields(data: InvoiceData, t: Record<string, string>): string[] {
  const isOtpremnica = data.documentType === 'otpremnica';
  const missing: string[] = [];
  if (!data.invoiceNumber?.trim()) missing.push(isOtpremnica ? t.documentNumber : t.invoiceNumber);
  if (!data.seller?.name?.trim()) missing.push(`${t.seller}: ${t.companyName}`);
  if (!data.seller?.pib || !/^\d{9}$/.test(data.seller.pib)) missing.push(`${t.seller}: ${t.pib}`);
  if (!data.buyer?.name?.trim()) missing.push(`${t.buyer}: ${t.companyName}`);
  if (!data.buyer?.pib || !/^\d{9}$/.test(data.buyer.pib)) missing.push(`${t.buyer}: ${t.pib}`);
  if (!data.issueDate) missing.push(t.issueDate);
  if (!isOtpremnica && !data.dueDate) missing.push(t.dueDate);
  if (!data.items?.length || !data.items.some(i => i.description?.trim())) missing.push(t.items);
  return missing;
}
