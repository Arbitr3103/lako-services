import type { APIRoute } from 'astro';
import { jsonResponse, parseLimitedJson } from '../../utils/api-request';
import { createRateLimiter, getClientIp } from '../../utils/rate-limit';
import { getWorkerEnv } from '../../utils/worker-env';

const ALLOWED_ORIGINS = import.meta.env.DEV
  ? ['https://lako.services', 'http://localhost:4321']
  : ['https://lako.services'];

// 5 requests per 5 minutes per IP
const limiter = createRateLimiter({ windowMs: 5 * 60_000, maxRequests: 5 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 500;
const MAX_MESSAGE_LEN = 5000;
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
    const name = sanitize(data.name);
    const email = sanitize(data.email);
    const phone = sanitize(data.phone);
    const businessType = sanitize(data.businessType);
    const message = sanitize(data.message, MAX_MESSAGE_LEN);

    // Validate required fields
    if (!name || !email || !message) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    // Validate email format
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ error: 'Invalid email address' }, 400);
    }

    // Validate phone format if provided (digits, spaces, dashes, plus, parentheses)
    if (phone && !/^[\d\s\-+()]{6,20}$/.test(phone)) {
      return jsonResponse({ error: 'Invalid phone number format' }, 400);
    }

    const cfEnv = getWorkerEnv();
    const RESEND_API_KEY = cfEnv.RESEND_API_KEY;
    const TELEGRAM_BOT_TOKEN = cfEnv.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = cfEnv.TELEGRAM_CHAT_ID;

    let emailSent = false;
    let telegramSent = false;

    // Email via Resend
    if (RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Lako Services <noreply@lako.services>',
            to: 'info@lako.services',
            reply_to: email,
            subject: `Nova poruka od ${sanitizeHeaderValue(name)} (${sanitizeHeaderValue(businessType)})`,
            html: `
              <h2>Nova poruka sa sajta</h2>
              <p><strong>Ime:</strong> ${escapeTgHtml(name)}</p>
              <p><strong>Email:</strong> ${escapeTgHtml(email)}</p>
              <p><strong>Telefon:</strong> ${escapeTgHtml(phone || 'N/A')}</p>
              <p><strong>Tip biznisa:</strong> ${escapeTgHtml(businessType)}</p>
              <p><strong>Poruka:</strong></p>
              <p>${escapeTgHtml(message)}</p>
            `,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (resendRes.ok) {
          emailSent = true;
        } else {
          const errBody = await resendRes.text();
          console.error('Resend API error:', resendRes.status, errBody);
        }
      } catch (e) {
        console.error('Resend fetch error:', e);
      }
    } else {
      console.error('RESEND_API_KEY not configured');
    }

    // Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const text = [
          `<b>Nova poruka sa sajta!</b>`,
          ``,
          `<b>Ime:</b> ${escapeTgHtml(name)}`,
          `<b>Email:</b> ${escapeTgHtml(email)}`,
          `<b>Telefon:</b> ${escapeTgHtml(phone || 'N/A')}`,
          `<b>Tip biznisa:</b> ${escapeTgHtml(businessType)}`,
          ``,
          `<b>Poruka:</b>`,
          escapeTgHtml(message),
        ].join('\n');

        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'HTML',
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (tgRes.ok) {
          telegramSent = true;
        } else {
          const errBody = await tgRes.text();
          console.error('Telegram API error:', tgRes.status, errBody);
        }
      } catch (e) {
        console.error('Telegram fetch error:', e);
      }
    } else {
      console.error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured');
    }

    // At least one channel must succeed
    if (!emailSent && !telegramSent) {
      return jsonResponse({ error: 'Failed to send message. Please try again or contact us directly.' }, 500);
    }

    return jsonResponse({ success: true });
  } catch {
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
};
