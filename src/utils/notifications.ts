/**
 * Outbound notification channels for form API routes:
 * transactional email via Resend and Telegram bot messages.
 * Both return `true` on success and never throw.
 */

const FETCH_TIMEOUT_MS = 10_000;

export interface ResendEmailOptions {
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendResendEmail(apiKey: string, opts: ResendEmailOptions): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Lako Services <noreply@lako.services>',
        to: 'info@lako.services',
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        subject: opts.subject,
        html: opts.html,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('Resend API error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Resend fetch error:', e);
    return false;
  }
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('Telegram API error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Telegram fetch error:', e);
    return false;
  }
}
