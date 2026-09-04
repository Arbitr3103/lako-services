import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const locales = ['sr', 'en', 'ru'] as const;
const pagePaths = [
  'src/pages/logistics.astro',
  'src/pages/en/logistics.astro',
  'src/pages/ru/logistics.astro',
];

function readJson(locale: string) {
  return JSON.parse(readFileSync(resolve(root, `src/i18n/${locale}.json`), 'utf8'));
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return '';
}

const forbiddenLogisticsClaims = [
  /early adopter/i,
  /\btrial\b/i,
  /probajte besplatno/i,
  /попробуйте бесплатно/i,
  /15\s*(sec|seconds|sek|sekundi|секунд)/i,
  /error-free|bez grešaka|без ошибок/i,
  /automatski|automatically|автоматически/i,
  /zaštita od kazni|гарантия оплаты|payment.*guarantee|72\s*(hours|sata|часа)/i,
  /potpuna.*(privatnost|bezbednost|sigurnost)|completely.*secure|абсолютн.*безопас/i,
  /backup|bekap|бэкап|rto|2-4 sata|2–4 часа/i,
  /garantovan.*gps|guaranteed.*gps|гарантирован.*gps/i,
];

const requiredTruth = {
  sr: ['podatke firme', 'PDF', 'XML', 'ručno učit'],
  en: ['company data', 'PDF', 'XML', 'manually upload'],
  ru: ['данные компании', 'PDF', 'XML', 'вручную загруж'],
};

const requiredPrivacy = {
  sr: ['Telegram platforme', 'izvor, medij, kampanju i sadržaj', 'zbirno', 'početak rada bota'],
  en: ['Telegram platform ID', 'source, medium, campaign and content', 'aggregate', 'bot start'],
  ru: ['идентификатор платформы Telegram', 'источник, канал, кампанию и содержание', 'агрегирован', 'запуск бота'],
};

describe('logistics landing contract', () => {
  it.each(locales)('keeps %s rendered logistics copy and SEO free of unsupported claims', (locale) => {
    const json = readJson(locale);
    const { guides: _guides, ...renderedLogistics } = json.logistics;
    const { guides: _seoGuides, ...renderedSeo } = json.seo.logistics;
    const renderedCopy = text({ logistics: renderedLogistics, seo: renderedSeo });

    for (const forbidden of forbiddenLogisticsClaims) {
      expect(renderedCopy).not.toMatch(forbidden);
    }
    expect(json.logistics.bot).not.toHaveProperty('pricing');
    for (const phrase of requiredTruth[locale]) {
      expect(renderedCopy).toContain(phrase);
    }
  });

  it.each(locales)('discloses %s Telegram logistics attribution conservatively', (locale) => {
    const json = readJson(locale);
    const privacyCopy = text(json.legal.privacy.sections);

    expect(privacyCopy).not.toMatch(/booking|appointment|rezervacij|zakazivanj|бронирован/iu);
    for (const phrase of requiredPrivacy[locale]) {
      expect(privacyCopy).toContain(phrase);
    }
  });

  it.each(pagePaths)('%s routes every Telegram CTA through the allowlisted helper and removes pricing', (pagePath) => {
    const page = readFileSync(resolve(root, pagePath), 'utf8');

    expect(page).toContain('logistics-telegram-url');
    expect(page).toContain('getLogisticsTelegramUrl(Astro.url.searchParams)');
    expect(page).toContain('href={telegramBotUrl}');
    expect(page).not.toMatch(/href="https:\/\/t\.me\/lakoprevoz_bot/);
    expect(page).not.toContain('botPricingPlans');
    expect(page).not.toContain('logistics.bot.pricing');
    expect(page).not.toMatch(/PDF \+ XML (za|in) 15 sec/);
  });
});
