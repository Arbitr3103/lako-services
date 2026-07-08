import { describe, expect, it } from 'vitest';

import { isIndexableGuidePage, isNoindexPath, isSitemapIncludedPath } from '../src/utils/seo-policy.js';

const highIntentGuideFeatures = ['cmr', 'efaktura', 'invoices', 'trips'] as const;
const localizedPromotionLocales = ['en', 'ru'] as const;

describe('SEO indexation policy', () => {
  it('indexes localized high-intent logistics guide pages for organic promotion', () => {
    for (const locale of localizedPromotionLocales) {
      for (const feature of highIntentGuideFeatures) {
        const pathname = `/${locale}/logistics/${feature}/`;

        expect(isIndexableGuidePage(locale, feature)).toBe(true);
        expect(isSitemapIncludedPath(pathname)).toBe(true);
        expect(isNoindexPath(pathname)).toBe(false);
      }
    }
  });

  it('keeps app-like Studio and secondary logistics pages out of the index', () => {
    const intentionallyNoindexPaths = [
      '/efaktura/studio/',
      '/en/efaktura/studio/',
      '/ru/efaktura/studio/',
      '/en/logistics/drivers/',
      '/ru/logistics/drivers/',
      '/en/logistics/customers/',
      '/ru/logistics/customers/',
    ];

    for (const pathname of intentionallyNoindexPaths) {
      expect(isSitemapIncludedPath(pathname)).toBe(false);
      expect(isNoindexPath(pathname)).toBe(true);
    }
  });
});
