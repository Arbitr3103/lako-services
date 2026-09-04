import { describe, expect, it } from 'vitest';

const PLAIN_BOT_URL = 'https://t.me/lakoprevoz_bot';
const ATTRIBUTED_BOT_URL = `${PLAIN_BOT_URL}?start=fb_lako_4w_demo_v3`;

async function resolveTelegramUrl(query: string) {
  const { getLogisticsTelegramUrl } = await import('../../src/utils/logistics-telegram-url');
  return getLogisticsTelegramUrl(new URLSearchParams(query));
}

async function resolveGuideUrl(path: string, query: string) {
  const { getLogisticsGuideUrl } = await import('../../src/utils/logistics-telegram-url');
  return getLogisticsGuideUrl(path, new URLSearchParams(query));
}

describe('getLogisticsTelegramUrl', () => {
  it('allows only the exact approved UTM tuple', async () => {
    await expect(resolveTelegramUrl('utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3')).resolves.toBe(ATTRIBUTED_BOT_URL);
  });

  it('allows Facebook click IDs alongside the exact approved tuple', async () => {
    await expect(resolveTelegramUrl('fbclid=opaque-value&utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3')).resolves.toBe(ATTRIBUTED_BOT_URL);
  });

  it.each([
    'utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w',
    'utm_source=facebook&utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3',
    'utm_source=Facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3',
    'UTM_term=drivers&utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3',
    'Utm_content=demo_v3&utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3',
    'utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3&utm_term=drivers',
  ])('fails closed for non-exact attribution: %s', async (query) => {
    await expect(resolveTelegramUrl(query)).resolves.toBe(PLAIN_BOT_URL);
  });

  it('preserves only approved attribution when navigating to a guide', async () => {
    await expect(resolveGuideUrl('/en/logistics/cmr/', 'utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3')).resolves.toBe('/en/logistics/cmr/?utm_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3');
    await expect(resolveGuideUrl('/en/logistics/cmr/', 'UTM_source=facebook&utm_medium=organic&utm_campaign=lako_logistics_4w&utm_content=demo_v3')).resolves.toBe('/en/logistics/cmr/');
  });
});
