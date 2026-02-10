import sr from './sr.json';
import en from './en.json';

export type Locale = 'sr' | 'en';

const translations = { sr, en } as const;

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
  return 'sr';
}

export function getLocalizedPath(path: string, locale: Locale): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'sr') return cleanPath;
  return `/en${cleanPath}`;
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'sr' ? 'en' : 'sr';
}

export function getPathWithoutLocale(pathname: string): string {
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  if (pathname === '/en') return '/';
  return pathname;
}
