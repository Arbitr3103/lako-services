const CORE_PATHS = new Set([
  '/',
  '/about/',
  '/contact/',
  '/cookie-policy/',
  '/dodaj-biznis/',
  '/efaktura/',
  '/logistics/',
  '/privacy-policy/',
  '/small-business/',
  '/terms/',
  '/zastita-podataka/',
]);

const GUIDE_PATHS = new Set([
  'cmr',
  'customers',
  'drivers',
  'efaktura',
  'invoices',
  'stats',
  'trips',
  'vehicles',
]);

const INDEXABLE_GUIDE_FEATURES_BY_LOCALE = {
  sr: new Set(['cmr', 'efaktura', 'invoices', 'trips']),
  en: new Set(['cmr', 'efaktura', 'invoices', 'trips']),
  ru: new Set(['cmr', 'efaktura', 'invoices', 'trips']),
};

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function splitLocaleFromPathname(pathname) {
  const normalized = normalizePathname(pathname);

  if (normalized === '/en/' || normalized.startsWith('/en/')) {
    const localizedPath = normalized.slice(3) || '/';
    return { locale: 'en', localizedPath: normalizePathname(localizedPath) };
  }

  if (normalized === '/ru/' || normalized.startsWith('/ru/')) {
    const localizedPath = normalized.slice(3) || '/';
    return { locale: 'ru', localizedPath: normalizePathname(localizedPath) };
  }

  return { locale: 'sr', localizedPath: normalized };
}

export function getGuideFeatureFromPathname(pathname) {
  const { localizedPath } = splitLocaleFromPathname(pathname);
  const match = localizedPath.match(/^\/logistics\/([^/]+)\/$/);
  if (!match) return null;

  const [, feature] = match;
  return GUIDE_PATHS.has(feature) ? feature : null;
}

export function isIndexableGuidePage(locale, feature) {
  return INDEXABLE_GUIDE_FEATURES_BY_LOCALE[locale]?.has(feature) ?? false;
}

export function isSitemapIncludedPath(pathname) {
  const { locale, localizedPath } = splitLocaleFromPathname(pathname);

  if (localizedPath === '/efaktura/studio/') {
    return false;
  }

  if (CORE_PATHS.has(localizedPath)) {
    return true;
  }

  const guideFeature = getGuideFeatureFromPathname(pathname);
  if (guideFeature) {
    return isIndexableGuidePage(locale, guideFeature);
  }

  return false;
}

export function isNoindexPath(pathname) {
  return !isSitemapIncludedPath(pathname);
}
