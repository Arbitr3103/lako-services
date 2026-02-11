import type { APIRoute } from 'astro';
import { RESEND_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, getSecret } from 'astro:env/server';

const LAKO_BOT_API_URL = 'https://bot.lako.services';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const REGISTRATION_SECRET = await getSecret('REGISTRATION_SECRET');
    const { businessName, category, city, address, phone, instagram, website, contactName, email } = data;

    if (!businessName || !category || !city || !address || !phone || !contactName || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Register in lako-bot database
    if (LAKO_BOT_API_URL && REGISTRATION_SECRET) {
      try {
        await fetch(`${LAKO_BOT_API_URL}/api/external/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${REGISTRATION_SECRET}`,
          },
          body: JSON.stringify(data),
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
            from: 'Lako Services <onboarding@resend.dev>',
            to: 'info@lako.services',
            subject: `Novi zahtev za registraciju: ${businessName} (${category})`,
            html: `
              <h2>Novi zahtev za registraciju biznisa</h2>
              <p><strong>Naziv:</strong> ${businessName}</p>
              <p><strong>Kategorija:</strong> ${category}</p>
              <p><strong>Grad:</strong> ${city}</p>
              <p><strong>Adresa:</strong> ${address}</p>
              <p><strong>Telefon:</strong> ${phone}</p>
              <p><strong>Instagram:</strong> ${instagram || 'N/A'}</p>
              <p><strong>Web sajt:</strong> ${website || 'N/A'}</p>
              <p><strong>Kontakt osoba:</strong> ${contactName}</p>
              <p><strong>Email:</strong> ${email}</p>
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
          `<b>Naziv:</b> ${businessName}`,
          `<b>Kategorija:</b> ${category}`,
          `<b>Grad:</b> ${city}`,
          `<b>Adresa:</b> ${address}`,
          `<b>Telefon:</b> ${phone}`,
          `<b>Instagram:</b> ${instagram || 'N/A'}`,
          `<b>Web sajt:</b> ${website || 'N/A'}`,
          `<b>Kontakt:</b> ${contactName}`,
          `<b>Email:</b> ${email}`,
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
