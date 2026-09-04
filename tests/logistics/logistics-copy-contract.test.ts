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
const guideComponentPath = 'src/components/FeatureGuide.astro';

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
  /automatsk\w*\s+(SEF|XML)|(SEF|XML)\s+automatsk\w*|automatic\w*\s+(SEF|XML)|(SEF|XML)\s+automatic\w*|автоматическ\w*\s+(SEF|XML)|(SEF|XML)\s+автоматическ\w*/i,
  /zaštita od kazni|гарантия оплаты|payment.*guarantee|72\s*(hours|sata|часа)/i,
  /potpuna.*(privatnost|bezbednost|sigurnost)|completely.*secure|абсолютн.*безопас/i,
  /backup|bekap|бэкап|rto|2-4 sata|2–4 часа/i,
  /garantovan.*gps|guaranteed.*gps|гарантирован.*gps/i,
  /legal compliance|usklađenost sa zakonom|соответствие закону/i,
  /digital.*proof|digitalni dokaz|цифровое подтверждение/i,
  /instant(ly)?|odmah|мгновенно/i,
  /real time|u realnom vremenu|в реальном времени/i,
  /all (modules|features|required details)|sve (module|potrebne podatke)|все (модули|необходимые данные)/i,
  /all required data|svim potrebnim podacima|всеми необходимыми данными/i,
  /any Android or iPhone|svaki Android ili iPhone|любой Android или iPhone/i,
];

const requiredTruth = {
  sr: ['podatke firme', 'PDF', 'XML', 'ručno učit'],
  en: ['company data', 'PDF', 'XML', 'manually upload'],
  ru: ['данные компании', 'PDF', 'XML', 'вручную загрузите'],
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
      expect(text(json.logistics.seoBlock)).toContain(phrase);
    }
  });

  it.each(locales)('discloses %s Telegram logistics attribution conservatively', (locale) => {
    const json = readJson(locale);
    const privacyCopy = text(json.legal.privacy.sections);

    expect(privacyCopy).not.toMatch(/booking|appointment|rezervacij|zakazivanj|бронирован/iu);
    for (const phrase of requiredPrivacy[locale]) {
      expect(privacyCopy).toContain(phrase);
    }
    expect(privacyCopy).not.toMatch(/2 years|2 godine|2 лет|while the account is active|dok je nalog aktivan|пока аккаунт активен/iu);
  });

  it.each(locales)('keeps %s public guide content within the bounded product truth', (locale) => {
    const json = readJson(locale);
    const guideCopy = text(json.logistics.guides);

    for (const forbidden of forbiddenLogisticsClaims) {
      expect(guideCopy).not.toMatch(forbidden);
    }
    for (const phrase of requiredTruth[locale]) {
      expect(text(json.logistics)).toContain(phrase);
    }
  });

  it.each(pagePaths)('%s routes every Telegram CTA through the allowlisted helper and removes pricing', (pagePath) => {
    const page = readFileSync(resolve(root, pagePath), 'utf8');

    expect(page).toContain('logistics-telegram-url');
    expect(page).toContain('getLogisticsTelegramUrl(Astro.url.searchParams)');
    expect(page).toContain('getLogisticsGuideUrl(');
    expect(page).toContain('href={telegramBotUrl}');
    expect(page).toContain('href={getGuideUrl(feature.slug)}');
    expect(page).not.toMatch(/href="https:\/\/t\.me\/lakoprevoz_bot/);
    expect(page).not.toContain('botPricingPlans');
    expect(page).not.toContain('logistics.bot.pricing');
    expect(page).not.toMatch(/PDF \+ XML (za|in) 15 sec/);
    expect(page).not.toMatch(/QR (potpis|signature|подпись).*?(Dokaz isporuke|Proof of delivery|доказательство доставки)/i);
  });

  it('uses the shared helper for the guide CTA and preserves only valid campaign attribution internally', () => {
    const guide = readFileSync(resolve(root, guideComponentPath), 'utf8');

    expect(guide).toContain('getLogisticsTelegramUrl(Astro.url.searchParams)');
    expect(guide).toContain('getLogisticsGuideUrl(');
    expect(guide).toContain('href={telegramBotUrl}');
    expect(guide).not.toMatch(/href="https:\/\/t\.me\/lakoprevoz_bot/);
  });
});
