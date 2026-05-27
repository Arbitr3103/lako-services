import type { APIRoute } from 'astro';
import { jsonResponse, parseLimitedJson } from '../../utils/api-request';
import { createRateLimiter, getClientIp } from '../../utils/rate-limit';
import { getWorkerEnv } from '../../utils/worker-env';

const DEFAULT_LAKO_BOT_API_URL = 'https://bot.lako.services';
const ALLOWED_ORIGINS = import.meta.env.DEV
  ? ['https://lako.services', 'http://localhost:4321']
  : ['https://lako.services'];

// 3 requests per 5 minutes per IP
const limiter = createRateLimiter({ windowMs: 5 * 60_000, maxRequests: 3 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 500;
const MAX_BODY_BYTES = 8 * 1024;

function escapeTgHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Strip newlines and control chars to prevent email header injection */
function sanitizeHeaderValue(s: string): string {
  return s.replace(/[\r\n\t]/g, ' ').trim().slice(0, 200);
}

/** Trim and enforce max length */
function sanitize(s: unknown, maxLen = MAX_FIELD_LEN): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    if (limiter.isRateLimited(clientIp)) {
      return jsonResponse(
        { error: 'Too many requests. Please try again later.' },
        429,
        { 'Retry-After': '300' }
      );
    }

    const origin = request.headers.get('Origin');
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const json = await parseLimitedJson(request, MAX_BODY_BYTES);
    if (!json.ok) return json.response;

    const data = json.data as Record<string, unknown>;

    const cfEnv = getWorkerEnv();
    const LAKO_BOT_API_URL = cfEnv.LAKO_BOT_API_URL || DEFAULT_LAKO_BOT_API_URL;
    const REGISTRATION_SECRET = cfEnv.REGISTRATION_SECRET;
    const RESEND_API_KEY = cfEnv.RESEND_API_KEY;
    const TELEGRAM_BOT_TOKEN = cfEnv.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = cfEnv.TELEGRAM_CHAT_ID;

    if (!REGISTRATION_SECRET) {
      console.error('REGISTRATION_SECRET not configured');
      return jsonResponse({ error: 'Registration service unavailable' }, 503);
    }

    const businessName = sanitize(data.businessName);
    const category = sanitize(data.category);
    const city = sanitize(data.city);
    const address = sanitize(data.address);
    const phone = sanitize(data.phone);
    const instagram = sanitize(data.instagram);
    const website = sanitize(data.website);
    const contactName = sanitize(data.contactName);
    const email = sanitize(data.email);

    if (!businessName || !category || !city || !address || !phone || !contactName || !email) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    // Validate email format
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ error: 'Invalid email address' }, 400);
    }

    // Validate phone format (digits, spaces, dashes, plus, parentheses)
    if (phone && !/^[\d\s\-+()]{6,20}$/.test(phone)) {
      return jsonResponse({ error: 'Invalid phone number format' }, 400);
    }

    // Validate website URL format if provided
    if (website && !/^https?:\/\/\S{1,450}$/.test(website)) {
      return jsonResponse({ error: 'Invalid website URL' }, 400);
    }

    // Build sanitized payload for downstream API
    const sanitizedData = { businessName, category, city, address, phone, instagram, website, contactName, email };

    // Register in lako-bot database
    if (LAKO_BOT_API_URL && REGISTRATION_SECRET) {
      try {
        const regRes = await fetch(`${LAKO_BOT_API_URL}/api/external/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${REGISTRATION_SECRET}`,
          },
          body: JSON.stringify(sanitizedData),
          signal: AbortSignal.timeout(10000),
        });
        if (!regRes.ok) {
          const errBody = await regRes.text().catch(() => 'unknown');
          console.error('lako-bot registration failed:', regRes.status, errBody);
          return jsonResponse({ error: 'Registracija nije uspela. Pokušajte ponovo.' }, 502);
        }
      } catch (e) {
        console.error('lako-bot registration error:', e);
        return jsonResponse({ error: 'Registracija nije uspela. Pokušajte ponovo.' }, 502);
      }
    }

    // Email via Resend
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Lako Services <noreply@lako.services>',
            to: 'info@lako.services',
            subject: `Novi zahtev za registraciju: ${sanitizeHeaderValue(businessName)} (${sanitizeHeaderValue(category)})`,
            html: `
              <h2>Novi zahtev za registraciju biznisa</h2>
              <p><strong>Naziv:</strong> ${escapeTgHtml(businessName)}</p>
              <p><strong>Kategorija:</strong> ${escapeTgHtml(category)}</p>
              <p><strong>Grad:</strong> ${escapeTgHtml(city)}</p>
              <p><strong>Adresa:</strong> ${escapeTgHtml(address)}</p>
              <p><strong>Telefon:</strong> ${escapeTgHtml(phone)}</p>
              <p><strong>Instagram:</strong> ${escapeTgHtml(instagram || 'N/A')}</p>
              <p><strong>Web sajt:</strong> ${escapeTgHtml(website || 'N/A')}</p>
              <p><strong>Kontakt osoba:</strong> ${escapeTgHtml(contactName)}</p>
              <p><strong>Email:</strong> ${escapeTgHtml(email)}</p>
            `,
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch (e) {
        console.error('Resend error:', e);
      }
    }

    // Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const text = [
          `<b>Novi zahtev za registraciju!</b>`,
          ``,
          `<b>Naziv:</b> ${escapeTgHtml(businessName)}`,
          `<b>Kategorija:</b> ${escapeTgHtml(category)}`,
          `<b>Grad:</b> ${escapeTgHtml(city)}`,
          `<b>Adresa:</b> ${escapeTgHtml(address)}`,
          `<b>Telefon:</b> ${escapeTgHtml(phone)}`,
          `<b>Instagram:</b> ${escapeTgHtml(instagram || 'N/A')}`,
          `<b>Web sajt:</b> ${escapeTgHtml(website || 'N/A')}`,
          `<b>Kontakt:</b> ${escapeTgHtml(contactName)}`,
          `<b>Email:</b> ${escapeTgHtml(email)}`,
        ].join('\n');

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'HTML',
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch (e) {
        console.error('Telegram error:', e);
      }
    }

    return jsonResponse({ success: true });
  } catch {
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
};
