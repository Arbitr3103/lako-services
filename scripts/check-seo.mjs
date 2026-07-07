import fs from 'node:fs';
import path from 'node:path';

import { isNoindexPath, isSitemapIncludedPath } from '../src/utils/seo-policy.js';

const distRoot = path.join(process.cwd(), 'dist');
const SITEMAP_PATH = ['sitemap-0.xml', path.join('client', 'sitemap-0.xml')]
  .map((relativePath) => path.join(distRoot, relativePath))
  .find((candidatePath) => fs.existsSync(candidatePath));
const SITE_URL = 'https://lako.services';

const expectedIncludedPaths = [
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
  '/en/',
  '/en/about/',
  '/en/contact/',
  '/en/cookie-policy/',
  '/en/dodaj-biznis/',
  '/en/efaktura/',
  '/en/logistics/',
  '/en/privacy-policy/',
  '/en/small-business/',
  '/en/terms/',
  '/en/zastita-podataka/',
  '/ru/',
  '/ru/about/',
  '/ru/contact/',
  '/ru/cookie-policy/',
  '/ru/dodaj-biznis/',
  '/ru/efaktura/',
  '/ru/logistics/',
  '/ru/privacy-policy/',
  '/ru/small-business/',
  '/ru/terms/',
  '/ru/zastita-podataka/',
  '/logistics/cmr/',
  '/logistics/efaktura/',
  '/logistics/invoices/',
  '/logistics/trips/',
];

const expectedExcludedPaths = [
  '/efaktura/studio/',
  '/en/efaktura/studio/',
  '/ru/efaktura/studio/',
  '/logistics/customers/',
  '/logistics/drivers/',
  '/logistics/stats/',
  '/logistics/vehicles/',
  '/en/logistics/cmr/',
  '/en/logistics/customers/',
  '/en/logistics/drivers/',
  '/en/logistics/efaktura/',
  '/en/logistics/invoices/',
  '/en/logistics/stats/',
  '/en/logistics/trips/',
  '/en/logistics/vehicles/',
  '/ru/logistics/cmr/',
  '/ru/logistics/customers/',
  '/ru/logistics/drivers/',
  '/ru/logistics/efaktura/',
  '/ru/logistics/invoices/',
  '/ru/logistics/stats/',
  '/ru/logistics/trips/',
  '/ru/logistics/vehicles/',
];

const guidePaths = [
  '/logistics/cmr/',
  '/logistics/customers/',
  '/logistics/drivers/',
  '/logistics/efaktura/',
  '/logistics/invoices/',
  '/logistics/stats/',
  '/logistics/trips/',
  '/logistics/vehicles/',
  '/en/logistics/cmr/',
  '/en/logistics/customers/',
  '/en/logistics/drivers/',
  '/en/logistics/efaktura/',
  '/en/logistics/invoices/',
  '/en/logistics/stats/',
  '/en/logistics/trips/',
  '/en/logistics/vehicles/',
  '/ru/logistics/cmr/',
  '/ru/logistics/customers/',
  '/ru/logistics/drivers/',
  '/ru/logistics/efaktura/',
  '/ru/logistics/invoices/',
  '/ru/logistics/stats/',
  '/ru/logistics/trips/',
  '/ru/logistics/vehicles/',
];

const expectedRedirectChecks = [
  { from: '/logistics', to: '/logistics/' },
  { from: '/efaktura', to: '/efaktura/' },
  { from: '/about', to: '/about/' },
  { from: '/contact', to: '/contact/' },
  // Historical GSC examples. These are expected canonical redirects, not bugs.
  { from: '/en/logistics', to: '/en/logistics/' },
  { from: '/ru/efaktura', to: '/ru/efaktura/' },
  { from: '/small-business', to: '/small-business/' },
];

const expectedProductionHttpsRedirectChecks = [
  { from: 'http://lako.services/cookie-policy', to: 'https://lako.services/cookie-policy/' },
  { from: 'http://lako.services/cookie-policy/', to: 'https://lako.services/cookie-policy/' },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractUrls(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
}

function extractCanonical(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
}

function hasNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function extractAlternates(html) {
  return [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((match) => ({
    hreflang: match[1],
    href: match[2],
  }));
}

function extractInternalHrefs(html) {
  return [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith('/') && !href.startsWith('//'));
}

function isPageLikeInternalPath(pathname) {
  if (!pathname || pathname === '/' || pathname.endsWith('/')) return false;
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;
  const lastSegment = pathname.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

async function checkRuntimeSeo(baseUrl) {
  const stats = {
    intentionalNoindexVerified: 0,
    redirectsVerified: 0,
    sitemapRuntimeUrlsVerified: 0,
  };

  const pages = [
    {
      path: '/',
      canonical: `${SITE_URL}/`,
      alternates: [
        { hreflang: 'sr', href: `${SITE_URL}/` },
        { hreflang: 'en', href: `${SITE_URL}/en/` },
        { hreflang: 'ru', href: `${SITE_URL}/ru/` },
        { hreflang: 'x-default', href: `${SITE_URL}/` },
      ],
    },
    {
      path: '/en/',
      canonical: `${SITE_URL}/en/`,
      alternates: [
        { hreflang: 'sr', href: `${SITE_URL}/` },
        { hreflang: 'en', href: `${SITE_URL}/en/` },
        { hreflang: 'ru', href: `${SITE_URL}/ru/` },
        { hreflang: 'x-default', href: `${SITE_URL}/` },
      ],
    },
    {
      path: '/efaktura/',
      canonical: `${SITE_URL}/efaktura/`,
      alternates: [
        { hreflang: 'sr', href: `${SITE_URL}/efaktura/` },
        { hreflang: 'en', href: `${SITE_URL}/en/efaktura/` },
        { hreflang: 'ru', href: `${SITE_URL}/ru/efaktura/` },
        { hreflang: 'x-default', href: `${SITE_URL}/efaktura/` },
      ],
    },
  ];

  for (const page of pages) {
    const response = await fetch(new URL(page.path, baseUrl));
    assert(response.ok, `Expected ${page.path} to return 200, got ${response.status}`);

    const html = await response.text();
    const canonical = extractCanonical(html);
    assert(canonical === page.canonical, `Unexpected canonical for ${page.path}: ${canonical}`);

    const alternates = extractAlternates(html);
    for (const expected of page.alternates) {
      assert(
        alternates.some((alt) => alt.hreflang === expected.hreflang && alt.href === expected.href),
        `Missing alternate ${expected.hreflang} for ${page.path}`,
      );
    }
  }

  for (const pathname of sitemapPaths) {
    const pageUrl = new URL(pathname, baseUrl);
    const response = await fetch(pageUrl, { redirect: 'manual' });
    assert(response.status === 200, `Expected sitemap URL ${pathname} to return 200, got ${response.status}`);

    const html = await response.text();
    const canonical = extractCanonical(html);
    assert(canonical === new URL(pathname, SITE_URL).href, `Unexpected canonical for ${pathname}: ${canonical}`);
    assert(!hasNoindex(html), `Sitemap URL must not be noindex: ${pathname}`);
    stats.sitemapRuntimeUrlsVerified += 1;

    for (const href of extractInternalHrefs(html)) {
      const linkedUrl = new URL(href, SITE_URL);
      assert(
        !isPageLikeInternalPath(linkedUrl.pathname),
        `Internal link should not require trailing-slash redirect on ${pathname}: ${href}`,
      );
    }
  }

  for (const pathname of expectedExcludedPaths) {
    const response = await fetch(new URL(pathname, baseUrl), { redirect: 'manual' });
    assert(response.status === 200, `Expected excluded URL ${pathname} to return 200, got ${response.status}`);
    const html = await response.text();
    assert(hasNoindex(html), `Excluded URL must emit noindex: ${pathname}`);
    stats.intentionalNoindexVerified += 1;
  }

  for (const check of expectedRedirectChecks) {
    const response = await fetch(new URL(check.from, baseUrl), { redirect: 'manual' });
    assert(response.status === 308, `Expected ${check.from} to redirect with 308, got ${response.status}`);
    const location = response.headers.get('location');
    assert(location === new URL(check.to, baseUrl).href, `Unexpected redirect for ${check.from}: ${location}`);
    stats.redirectsVerified += 1;
  }

  if (new URL(baseUrl).hostname === 'lako.services') {
    for (const check of expectedProductionHttpsRedirectChecks) {
      const response = await fetch(check.from, { redirect: 'manual' });
      assert(response.status === 308, `Expected ${check.from} to redirect with 308, got ${response.status}`);
      const location = response.headers.get('location');
      assert(location === check.to, `Unexpected HTTPS redirect for ${check.from}: ${location}`);
      stats.redirectsVerified += 1;
    }
  }

  const apiResponse = await fetch(new URL('/api/contact', baseUrl), { redirect: 'manual' });
  assert(apiResponse.status !== 308, 'API routes must not be trailing-slash redirected');

  return stats;
}

assert(SITEMAP_PATH, 'Missing sitemap-0.xml in dist/ or dist/client/. Run npm run build first.');

const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
const sitemapPaths = new Set(extractUrls(xml));

for (const includedPath of expectedIncludedPaths) {
  assert(sitemapPaths.has(includedPath), `Missing expected sitemap URL: ${includedPath}`);
  assert(isSitemapIncludedPath(includedPath), `SEO policy must include expected path: ${includedPath}`);
  assert(!isNoindexPath(includedPath), `SEO policy must not noindex expected path: ${includedPath}`);
}

for (const excludedPath of expectedExcludedPaths) {
  assert(!sitemapPaths.has(excludedPath), `Unexpected sitemap URL: ${excludedPath}`);
  assert(!isSitemapIncludedPath(excludedPath), `SEO policy must exclude expected path: ${excludedPath}`);
  assert(isNoindexPath(excludedPath), `SEO policy must noindex expected path: ${excludedPath}`);
}

const includedGuides = guidePaths.filter((guidePath) => sitemapPaths.has(guidePath));
assert(includedGuides.length === 4, `Expected 4 indexable guide pages, found ${includedGuides.length}`);

const runtimeStats = process.env.SEO_BASE_URL
  ? await checkRuntimeSeo(process.env.SEO_BASE_URL)
  : null;

console.log(`SEO checks passed. Sitemap URLs: ${sitemapPaths.size}. Included guides: ${includedGuides.length}.`);

if (runtimeStats) {
  console.log(`Runtime sitemap URLs verified: ${runtimeStats.sitemapRuntimeUrlsVerified}.`);
  console.log(`Expected canonical redirects verified: ${runtimeStats.redirectsVerified}.`);
  console.log(`Intentional noindex pages verified: ${runtimeStats.intentionalNoindexVerified}.`);
  console.log('GSC note: redirect validation can fail for intentional non-slash canonical redirects; do not rerun unless sitemap or internal links leak non-slash URLs.');
}
