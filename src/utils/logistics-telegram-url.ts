const PLAIN_BOT_URL = 'https://t.me/lakoprevoz_bot';
const ATTRIBUTED_BOT_URL = `${PLAIN_BOT_URL}?start=fb_lako_4w_demo_v3`;

const APPROVED_UTMS = {
  utm_source: 'facebook',
  utm_medium: 'organic',
  utm_campaign: 'lako_logistics_4w',
  utm_content: 'demo_v3',
} as const;

/**
 * Returns an attributed Telegram link only for the exact approved campaign
 * tuple. Unknown, repeated, missing, or altered UTM values intentionally
 * fall back to the bot's plain URL.
 */
export function getLogisticsTelegramUrl(searchParams: URLSearchParams): string {
  for (const key of searchParams.keys()) {
    if (key.startsWith('utm_') && !(key in APPROVED_UTMS)) {
      return PLAIN_BOT_URL;
    }
  }

  for (const [key, value] of Object.entries(APPROVED_UTMS)) {
    const values = searchParams.getAll(key);
    if (values.length !== 1 || values[0] !== value) {
      return PLAIN_BOT_URL;
    }
  }

  return ATTRIBUTED_BOT_URL;
}
