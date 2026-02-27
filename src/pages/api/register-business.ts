import type { APIRoute } from 'astro';

const LAKO_BOT_API_URL = 'https://bot.lako.services';
const ALLOWED_ORIGINS = ['https://lako.services', 'http://localhost:4321'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 500;

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

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const origin = request.headers.get('Origin');
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await request.json();

    // Access Cloudflare Worker env bindings directly
    const cfEnv = (locals as any).runtime?.env ?? {};
    const REGISTRATION_SECRET = cfEnv.REGISTRATION_SECRET;
    const RESEND_API_KEY = cfEnv.RESEND_API_KEY;
    const TELEGRAM_BOT_TOKEN = cfEnv.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = cfEnv.TELEGRAM_CHAT_ID;

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
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (!EMAIL_RE.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build sanitized payload for downstream API
    const sanitizedData = { businessName, category, city, address, phone, instagram, website, contactName, email };

    // Register in lako-bot database
    if (LAKO_BOT_API_URL && REGISTRATION_SECRET) {
      try {
        await fetch(`${LAKO_BOT_API_URL}/api/external/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${REGISTRATION_SECRET}`,
          },
          body: JSON.stringify(sanitizedData),
        });
      } catch (e) {
        console.error('lako-bot registration error:', e);
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
        });
      } catch (e) {
        console.error('Telegram error:', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
