import type { APIRoute } from 'astro';
import { jsonResponse, parseLimitedJson } from '../../utils/api-request';
import { createRateLimiter, getClientIp } from '../../utils/rate-limit';
import { getWorkerEnv } from '../../utils/worker-env';
import { EMAIL_RE, PHONE_RE, escapeHtml, isAllowedOrigin, sanitize, sanitizeHeaderValue } from '../../utils/api-validation';
import { sendResendEmail, sendTelegramMessage } from '../../utils/notifications';

export const prerender = false;

const DEFAULT_LAKO_BOT_API_URL = 'https://bot.lako.services';

// 3 requests per 5 minutes per IP
const limiter = createRateLimiter({ windowMs: 5 * 60_000, maxRequests: 3 });
const MAX_BODY_BYTES = 8 * 1024;

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

    if (!isAllowedOrigin(request)) {
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

    // Validate phone format
    if (phone && !PHONE_RE.test(phone)) {
      return jsonResponse({ error: 'Invalid phone number format' }, 400);
    }

    // Validate website URL format if provided
    if (website && !/^https?:\/\/\S{1,450}$/.test(website)) {
      return jsonResponse({ error: 'Invalid website URL' }, 400);
    }

    // Build sanitized payload for downstream API
    const sanitizedData = { businessName, category, city, address, phone, instagram, website, contactName, email };

    // Register in lako-bot database — the critical step; notifications below are best-effort
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

    // Email via Resend
    if (RESEND_API_KEY) {
      await sendResendEmail(RESEND_API_KEY, {
        subject: `Novi zahtev za registraciju: ${sanitizeHeaderValue(businessName)} (${sanitizeHeaderValue(category)})`,
        html: `
          <h2>Novi zahtev za registraciju biznisa</h2>
          <p><strong>Naziv:</strong> ${escapeHtml(businessName)}</p>
          <p><strong>Kategorija:</strong> ${escapeHtml(category)}</p>
          <p><strong>Grad:</strong> ${escapeHtml(city)}</p>
          <p><strong>Adresa:</strong> ${escapeHtml(address)}</p>
          <p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>
          <p><strong>Instagram:</strong> ${escapeHtml(instagram || 'N/A')}</p>
          <p><strong>Web sajt:</strong> ${escapeHtml(website || 'N/A')}</p>
          <p><strong>Kontakt osoba:</strong> ${escapeHtml(contactName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        `,
      });
    }

    // Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const text = [
        `<b>Novi zahtev za registraciju!</b>`,
        ``,
        `<b>Naziv:</b> ${escapeHtml(businessName)}`,
        `<b>Kategorija:</b> ${escapeHtml(category)}`,
        `<b>Grad:</b> ${escapeHtml(city)}`,
        `<b>Adresa:</b> ${escapeHtml(address)}`,
        `<b>Telefon:</b> ${escapeHtml(phone)}`,
        `<b>Instagram:</b> ${escapeHtml(instagram || 'N/A')}`,
        `<b>Web sajt:</b> ${escapeHtml(website || 'N/A')}`,
        `<b>Kontakt:</b> ${escapeHtml(contactName)}`,
        `<b>Email:</b> ${escapeHtml(email)}`,
      ].join('\n');

      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, text);
    }

    return jsonResponse({ success: true });
  } catch {
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
};
