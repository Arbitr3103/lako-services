import sr from './sr.json';
import en from './en.json';
import ru from './ru.json';

export type Locale = 'sr' | 'en' | 'ru';

export const ALL_LOCALES: Locale[] = ['sr', 'en', 'ru'];
export const LOCALE_LABELS: Record<Locale, string> = { sr: 'SR', en: 'EN', ru: 'RU' };

const translations = { sr, en, ru } as const;

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object
      ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
      : `${K}`
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<typeof sr>;

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function t(locale: Locale, key: string): string {
  const value = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
  if (typeof value === 'string') return value;
  return key;
}

export function tObject<T = unknown>(locale: Locale, key: string): T {
  const value = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
  return value as T;
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  if (lang === 'en') return 'en';
  if (lang === 'ru') return 'ru';
  return 'sr';
}

export function getLocalizedPath(path: string, locale: Locale): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'sr') return cleanPath;
  if (locale === 'en') return `/en${cleanPath}`;
  return `/ru${cleanPath}`;
}

export function getOtherLocales(locale: Locale): Locale[] {
  return ALL_LOCALES.filter(l => l !== locale);
}

export function getPathWithoutLocale(pathname: string): string {
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/ru/')) return pathname.slice(3);
  if (pathname === '/ru') return '/';
  return pathname;
}
