/**
 * Shared validation and sanitization helpers for form API routes
 * (/api/contact, /api/register-business).
 */

export const ALLOWED_ORIGINS = import.meta.env.DEV
  ? ['https://lako.services', 'http://localhost:4321']
  : ['https://lako.services'];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Digits, spaces, dashes, plus, parentheses */
export const PHONE_RE = /^[\d\s\-+()]{6,20}$/;

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}

/** Escape HTML special chars for Telegram HTML parse mode and email bodies */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Strip newlines and control chars to prevent email header injection */
export function sanitizeHeaderValue(s: string): string {
  return s.replace(/[\r\n\t]/g, ' ').trim().slice(0, 200);
}

/** Trim and enforce max length */
export function sanitize(s: unknown, maxLen = 500): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, maxLen);
}
