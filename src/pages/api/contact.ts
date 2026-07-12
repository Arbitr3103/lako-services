import type { APIRoute } from 'astro';
import { jsonResponse, parseLimitedJson } from '../../utils/api-request';
import { createRateLimiter, getClientIp } from '../../utils/rate-limit';
import { getWorkerEnv } from '../../utils/worker-env';
import { EMAIL_RE, PHONE_RE, escapeHtml, isAllowedOrigin, sanitize, sanitizeHeaderValue } from '../../utils/api-validation';
import { sendResendEmail, sendTelegramMessage } from '../../utils/notifications';

// 5 requests per 5 minutes per IP
const limiter = createRateLimiter({ windowMs: 5 * 60_000, maxRequests: 5 });
const MAX_MESSAGE_LEN = 5000;
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

    // Validate phone format if provided
    if (phone && !PHONE_RE.test(phone)) {
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
      emailSent = await sendResendEmail(RESEND_API_KEY, {
        replyTo: email,
        subject: `Nova poruka od ${sanitizeHeaderValue(name)} (${sanitizeHeaderValue(businessType)})`,
        html: `
          <h2>Nova poruka sa sajta</h2>
          <p><strong>Ime:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Telefon:</strong> ${escapeHtml(phone || 'N/A')}</p>
          <p><strong>Tip biznisa:</strong> ${escapeHtml(businessType)}</p>
          <p><strong>Poruka:</strong></p>
          <p>${escapeHtml(message)}</p>
        `,
      });
    } else {
      console.error('RESEND_API_KEY not configured');
    }

    // Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const text = [
        `<b>Nova poruka sa sajta!</b>`,
        ``,
        `<b>Ime:</b> ${escapeHtml(name)}`,
        `<b>Email:</b> ${escapeHtml(email)}`,
        `<b>Telefon:</b> ${escapeHtml(phone || 'N/A')}`,
        `<b>Tip biznisa:</b> ${escapeHtml(businessType)}`,
        ``,
        `<b>Poruka:</b>`,
        escapeHtml(message),
      ].join('\n');

      telegramSent = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, text);
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
