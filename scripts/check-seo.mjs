import fs from 'node:fs';
import path from 'node:path';

import { isNoindexPath, isSitemapIncludedPath } from '../src/utils/seo-policy.js';
import { assertExpectedSecurityHeaders } from './http-security-headers.mjs';

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
  '/en/logistics/cmr/',
  '/en/logistics/efaktura/',
  '/en/logistics/invoices/',
  '/en/logistics/trips/',
  '/ru/logistics/cmr/',
  '/ru/logistics/efaktura/',
  '/ru/logistics/invoices/',
  '/ru/logistics/trips/',
];

const expectedExcludedPaths = [
  '/efaktura/studio/',
  '/en/efaktura/studio/',
  '/ru/efaktura/studio/',
  '/logistics/customers/',
  '/logistics/drivers/',
  '/logistics/stats/',
  '/logistics/vehicles/',
  '/en/logistics/customers/',
  '/en/logistics/drivers/',
  '/en/logistics/stats/',
  '/en/logistics/vehicles/',
  '/ru/logistics/customers/',
  '/ru/logistics/drivers/',
  '/ru/logistics/stats/',
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

const expectedProductionHttpsRedirectChecks = [
  { from: 'http://lako.services/', to: 'https://lako.services/' },
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

function extractElementText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match?.[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim() ?? null;
}

function extractJsonLd(html) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

function getBuiltHtmlPath(pathname) {
  const relativePath = pathname === '/'
    ? 'index.html'
    : path.join(pathname.replace(/^\//, ''), 'index.html');
  return path.join(distRoot, 'client', relativePath);
}

function collectBuiltPagePaths() {
  const clientRoot = path.join(distRoot, 'client');
  const pagePaths = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.name === 'index.html') {
        const relativeDirectory = path.relative(clientRoot, directory);
        pagePaths.push(relativeDirectory ? `/${relativeDirectory.split(path.sep).join('/')}/` : '/');
      }
    }
  }

  walk(clientRoot);
  return pagePaths.sort();
}

function getBaseLocalePath(pathname) {
  return pathname.replace(/^\/(en|ru)(?=\/)/, '') || '/';
}

function getExpectedLocalizedUrl(pathname, locale) {
  const basePath = getBaseLocalePath(pathname);
  const localizedPath = locale === 'sr'
    ? basePath
    : basePath === '/' ? `/${locale}/` : `/${locale}${basePath}`;
  return new URL(localizedPath, SITE_URL).href;
}

function checkBuiltHtml(builtPagePaths) {
  const expectedPagePaths = new Set([...expectedIncludedPaths, ...expectedExcludedPaths]);
  assert(
    builtPagePaths.length === expectedPagePaths.size,
    `Unexpected prerendered page count: expected ${expectedPagePaths.size}, found ${builtPagePaths.length}`,
  );
  for (const pathname of builtPagePaths) {
    assert(expectedPagePaths.has(pathname), `Unexpected prerendered HTML page: ${pathname}`);
  }

  let staticPagesVerified = 0;

  for (const pathname of builtPagePaths) {
    const htmlPath = getBuiltHtmlPath(pathname);
    assert(fs.existsSync(htmlPath), `Expected prerendered HTML for ${pathname}: ${htmlPath}`);

    const html = fs.readFileSync(htmlPath, 'utf8');
    const canonical = extractCanonical(html);
    assert(canonical === new URL(pathname, SITE_URL).href, `Unexpected built canonical for ${pathname}: ${canonical}`);
    assert(hasNoindex(html) === isNoindexPath(pathname), `Unexpected built robots policy for ${pathname}`);

    const alternates = extractAlternates(html);
    for (const locale of ['sr', 'en', 'ru']) {
      const expectedHref = getExpectedLocalizedUrl(pathname, locale);
      assert(
        alternates.some((alternate) => alternate.hreflang === locale && alternate.href === expectedHref),
        `Missing built alternate ${locale} for ${pathname}`,
      );
    }
    const expectedDefaultHref = getExpectedLocalizedUrl(pathname, 'sr');
    assert(
      alternates.some((alternate) => alternate.hreflang === 'x-default' && alternate.href === expectedDefaultHref),
      `Missing built alternate x-default for ${pathname}`,
    );

    for (const href of extractInternalHrefs(html)) {
      const linkedUrl = new URL(href, SITE_URL);
      assert(
        !isPageLikeInternalPath(linkedUrl.pathname),
        `Built internal link should not require trailing-slash redirect on ${pathname}: ${href}`,
      );
    }

    staticPagesVerified += 1;
  }

  const contentChecks = [
    {
      path: '/',
      title: 'Lako Services — Telegram botovi za automatizaciju biznisa | Novi Sad',
      h1: 'Telegram botovi za logistiku i mali biznis u Srbiji',
      requiredHrefs: ['/small-business/', '/efaktura/'],
    },
    {
      path: '/small-business/',
      title: 'Online zakazivanje termina za salone i servise | Lako Services',
      h1: 'Online zakazivanje i upravljanje terminima za salon, ordinaciju ili servis',
      requiredText: 'Kako podesiti trajanje usluge i slobodne termine',
    },
    {
      path: '/efaktura/',
      title: 'Besplatan generator e-faktura za SEF u Srbiji | Lako',
      h1: 'e-Faktura za SEF: PDF i UBL XML za 2 minuta',
      requiredHrefs: ['/logistics/efaktura/'],
    },
    {
      path: '/en/efaktura/',
      title: 'Free SEF e-Invoice Generator for Serbia | Lako',
      h1: 'SEF e-Invoices for Serbia: PDF and UBL XML in 2 Minutes',
    },
    {
      path: '/logistics/efaktura/',
      requiredHrefs: ['/efaktura/'],
    },
  ];

  for (const check of contentChecks) {
    const html = fs.readFileSync(getBuiltHtmlPath(check.path), 'utf8');
    if (check.title) {
      assert(extractElementText(html, 'title') === check.title, `Unexpected title for ${check.path}`);
    }
    if (check.h1) {
      assert(extractElementText(html, 'h1') === check.h1, `Unexpected H1 for ${check.path}`);
    }
    if (check.requiredText) {
      assert(html.includes(check.requiredText), `Missing required content on ${check.path}: ${check.requiredText}`);
    }
    for (const href of check.requiredHrefs ?? []) {
      assert(extractInternalHrefs(html).includes(href), `Missing internal link on ${check.path}: ${href}`);
    }
  }

  const homeHtml = fs.readFileSync(getBuiltHtmlPath('/'), 'utf8');
  const websiteJsonLd = extractJsonLd(homeHtml).find((entry) => entry['@type'] === 'WebSite');
  assert(websiteJsonLd?.name === 'Lako Services', 'Home WebSite JSON-LD must name Lako Services');
  assert(websiteJsonLd?.alternateName === 'Lako', 'Home WebSite JSON-LD must include Lako as alternateName');
  assert(websiteJsonLd?.url === `${SITE_URL}/`, 'Home WebSite JSON-LD must use the canonical site URL');

  return staticPagesVerified;
}

function checkBuiltRedirects(expectedRedirectChecks) {
  const redirectsPath = path.join(distRoot, 'client', '_redirects');
  assert(fs.existsSync(redirectsPath), `Missing built redirects file: ${redirectsPath}`);

  const rules = fs.readFileSync(redirectsPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [from, to, status] = line.split(/\s+/);
      return { from, status: Number(status), to };
    });
  const rulesBySource = new Map();

  for (const rule of rules) {
    assert(rule.from && rule.to && Number.isInteger(rule.status), `Invalid redirect rule in ${redirectsPath}`);
    assert(!rulesBySource.has(rule.from), `Duplicate redirect source in ${redirectsPath}: ${rule.from}`);
    rulesBySource.set(rule.from, rule);
  }

  for (const expected of expectedRedirectChecks) {
    const actual = rulesBySource.get(expected.from);
    assert(actual, `Missing built canonical redirect for ${expected.from}`);
    assert(actual.to === expected.to, `Unexpected built redirect target for ${expected.from}: ${actual.to}`);
    assert(actual.status === 308, `Canonical redirect must be 308 for ${expected.from}: ${actual.status}`);
  }

  assert(
    rules.length === expectedRedirectChecks.length,
    `Unexpected redirect rule count: expected ${expectedRedirectChecks.length}, found ${rules.length}`,
  );
  const expectedSources = new Set(expectedRedirectChecks.map((check) => check.from));
  for (const rule of rules) {
    assert(expectedSources.has(rule.from), `Unexpected built redirect source: ${rule.from}`);
  }

  return expectedRedirectChecks.length;
}

function isPageLikeInternalPath(pathname) {
  if (!pathname || pathname === '/' || pathname.endsWith('/')) return false;
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;
  const lastSegment = pathname.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

async function checkRuntimeSeo(baseUrl, expectedRedirectChecks) {
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
    assertExpectedSecurityHeaders(response, pathname);

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
    assertExpectedSecurityHeaders(response, pathname);
    const html = await response.text();
    assert(hasNoindex(html), `Excluded URL must emit noindex: ${pathname}`);
    stats.intentionalNoindexVerified += 1;
  }

  for (const check of expectedRedirectChecks) {
    const response = await fetch(new URL(check.from, baseUrl), { redirect: 'manual' });
    assert(response.status === 308, `Expected ${check.from} to redirect with 308, got ${response.status}`);
    const location = response.headers.get('location');
    const resolvedLocation = location ? new URL(location, new URL(check.from, baseUrl)).href : null;
    assert(resolvedLocation === new URL(check.to, baseUrl).href, `Unexpected redirect for ${check.from}: ${location}`);
    stats.redirectsVerified += 1;
  }

  if (new URL(baseUrl).hostname === 'lako.services') {
    for (const check of expectedProductionHttpsRedirectChecks) {
      const response = await fetch(check.from, { redirect: 'manual' });
      assert([301, 308].includes(response.status), `Expected ${check.from} to redirect permanently, got ${response.status}`);
      const location = response.headers.get('location');
      assert(location === check.to, `Unexpected HTTPS redirect for ${check.from}: ${location}`);
      stats.redirectsVerified += 1;
    }
  }

  const pagePostResponse = await fetch(new URL('/', baseUrl), { method: 'POST', redirect: 'manual' });
  assert(pagePostResponse.status === 405, `POST to a static page must return 405, got ${pagePostResponse.status}`);

  const nonCanonicalPagePost = await fetch(new URL('/about', baseUrl), {
    method: 'POST',
    redirect: 'manual',
  });
  assert(
    nonCanonicalPagePost.status === 308,
    `POST to a non-canonical static page must preserve the canonical 308, got ${nonCanonicalPagePost.status}`,
  );
  const nonCanonicalPostLocation = nonCanonicalPagePost.headers.get('location');
  assert(
    nonCanonicalPostLocation
      && new URL(nonCanonicalPostLocation, new URL('/about', baseUrl)).href === new URL('/about/', baseUrl).href,
    `Unexpected POST redirect for /about: ${nonCanonicalPostLocation}`,
  );

  const canonicalPagePost = await fetch(new URL('/about/', baseUrl), {
    method: 'POST',
    redirect: 'manual',
  });
  assert(
    canonicalPagePost.status === 405,
    `POST to a canonical static page must return 405, got ${canonicalPagePost.status}`,
  );

  for (const pathname of ['/api/contact', '/api/register-business']) {
    const apiUrl = new URL(pathname, baseUrl);
    const getResponse = await fetch(apiUrl, { redirect: 'manual' });
    assert(getResponse.status === 405, `GET ${pathname} must return 405, got ${getResponse.status}`);
    assert(getResponse.headers.get('allow') === 'POST', `GET ${pathname} must allow POST, got ${getResponse.headers.get('allow')}`);
    assertExpectedSecurityHeaders(getResponse, pathname);

    const postResponse = await fetch(apiUrl, {
      // Malformed JSON reaches our route parser without triggering downstream
      // registration or notifications. text/plain is intercepted by Astro's
      // cross-site form protection on the workers.dev hostname.
      body: '{',
      headers: {
        'content-type': 'application/json',
        origin: SITE_URL,
      },
      method: 'POST',
      redirect: 'manual',
    });
    assert(
      [400, 429].includes(postResponse.status),
      `Negative POST ${pathname} must reach the handler and return 400 or its rate-limit 429, got ${postResponse.status}`,
    );
    assertExpectedSecurityHeaders(postResponse, `${pathname} POST`);
    const postPayload = await postResponse.json();
    if (postResponse.status === 400) {
      assert(postPayload.error === 'Invalid request', `Unexpected 400 payload for ${pathname}`);
    } else {
      assert(postResponse.headers.get('retry-after') === '300', `Missing application rate-limit header for ${pathname}`);
      assert(postPayload.error === 'Too many requests. Please try again later.', `Unexpected 429 payload for ${pathname}`);
    }
  }

  return stats;
}

assert(SITEMAP_PATH, 'Missing sitemap-0.xml in dist/ or dist/client/. Run npm run build first.');

const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
const sitemapPaths = new Set(extractUrls(xml));
const builtPagePaths = collectBuiltPagePaths();
const expectedRedirectChecks = builtPagePaths
  .filter((pathname) => pathname !== '/')
  .map((pathname) => ({ from: pathname.slice(0, -1), to: pathname }));

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
assert(includedGuides.length === 12, `Expected 12 indexable guide pages, found ${includedGuides.length}`);

const staticPagesVerified = checkBuiltHtml(builtPagePaths);
const staticRedirectsVerified = checkBuiltRedirects(expectedRedirectChecks);

const runtimeStats = process.env.SEO_BASE_URL
  ? await checkRuntimeSeo(process.env.SEO_BASE_URL, expectedRedirectChecks)
  : null;

console.log(`SEO checks passed. Sitemap URLs: ${sitemapPaths.size}. Included guides: ${includedGuides.length}.`);
console.log(`Prerendered HTML pages verified: ${staticPagesVerified}.`);
console.log(`Permanent canonical redirects verified in build: ${staticRedirectsVerified}.`);

if (runtimeStats) {
  console.log(`Runtime sitemap URLs verified: ${runtimeStats.sitemapRuntimeUrlsVerified}.`);
  console.log(`Expected canonical redirects verified: ${runtimeStats.redirectsVerified}.`);
  console.log(`Intentional noindex pages verified: ${runtimeStats.intentionalNoindexVerified}.`);
  console.log('GSC note: redirect validation can fail for intentional non-slash canonical redirects; do not rerun unless sitemap or internal links leak non-slash URLs.');
}
