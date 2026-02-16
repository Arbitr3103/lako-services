import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
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

    // Access Cloudflare Worker env bindings directly
    const cfEnv = (locals as any).runtime?.env ?? {};
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
          `<b>Ime:</b> ${name}`,
          `<b>Email:</b> ${email}`,
          `<b>Telefon:</b> ${phone || 'N/A'}`,
          `<b>Tip biznisa:</b> ${businessType}`,
          ``,
          `<b>Poruka:</b>`,
          message,
        ].join('\n');

        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'HTML',
          }),
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
      return new Response(
        JSON.stringify({ error: 'Failed to send message. Please try again or contact us directly.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
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
