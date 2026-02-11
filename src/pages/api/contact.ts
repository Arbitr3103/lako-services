import type { APIRoute } from 'astro';
import { RESEND_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from 'astro:env/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { name, email, phone, businessType, message } = data;

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
            subject: `Nova poruka od ${name} (${businessType})`,
            html: `
              <h2>Nova poruka sa sajta</h2>
              <p><strong>Ime:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Telefon:</strong> ${phone || 'N/A'}</p>
              <p><strong>Tip biznisa:</strong> ${businessType}</p>
              <p><strong>Poruka:</strong></p>
              <p>${message}</p>
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
          `<b>Nova poruka sa sajta!</b>`,
          ``,
          `<b>Ime:</b> ${name}`,
          `<b>Email:</b> ${email}`,
          `<b>Telefon:</b> ${phone || 'N/A'}`,
          `<b>Tip biznisa:</b> ${businessType}`,
          ``,
          `<b>Poruka:</b>`,
          message,
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
