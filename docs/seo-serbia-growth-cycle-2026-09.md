# Serbia-first SEO growth cycle - September 2026

## Baseline

Google Search Console, 2026-08-05 through 2026-09-01:

- total: 10 clicks, 507 impressions, 2.0% CTR, average position 14.6;
- Serbia: 2 clicks, 175 impressions, 1.1% CTR;
- product pages with clicks: `/en/efaktura/`, `/en/small-business/`,
  `/efaktura/`, and `/logistics/efaktura/`;
- disclosed query: `lako service`; most click queries were anonymized by GSC;
- opportunity query: `podešavanje trajanja usluga u salonu` had 11 impressions
  at average position 13.1.

## Rolling 28-day target

- 25-30 total organic clicks;
- at least 10 clicks from Serbia;
- at least 6 clicks to product pages.

This is a directional target, not a release guarantee. Indexing and ranking may
take more than one 28-day cycle.

## First-cycle scope

- prerender marketing HTML and keep only the two form APIs on demand;
- strengthen `/small-business/` for online booking and service-duration intent;
- strengthen `/efaktura/` for Serbia and SEF intent;
- keep `/logistics/efaktura/` as the Telegram carrier workflow and link it to
  the separate browser-based Studio;
- add explicit product links and `WebSite` structured data on the Serbian home;
- do not add new landing-page URLs in this cycle.

Legal and technical wording is deliberately bounded. Studio generates UBL 2.1
XML intended for SEF upload; users must verify current obligations, deadlines,
and technical rules against official guidance or with their accountant.

Primary references:

- [Serbian e-invoicing law, consolidated 04.12.2025](https://www.efaktura.gov.rs/tekst/9490/zakon-o-elektronskom-fakturisanju-04122025.php)
- [Google Search Console anonymized queries](https://support.google.com/webmasters/answer/17011259?hl=en)

## Measurement

### D+7

- confirm complete HTML delivery on both production hostnames;
- confirm indexing state for `/`, `/small-business/`, `/efaktura/`, and
  `/logistics/efaktura/`;
- check for new canonical or noindex errors.

### D+14

- compare impressions, average position, clicks, and CTR for the four target
  pages;
- repeat with the country filter set to Serbia.

### D+28

- compare total, Serbia, and product-page clicks with the previous 28 days;
- if a target page reaches the top 10 but CTR is below 3%, test its title and
  description in the next cycle;
- if positions remain below the top 10, expand useful content and internal
  linking before creating another landing page.

## Release boundary

This document records the implementation and measurement contract. Merge,
deployment, Cloudflare setting changes, Search Console indexing requests, and
Notion synchronization are separate actions requiring explicit approval.

## Follow-up on 2026-09-08

Read-only GSC inspection confirmed the four first-cycle target URLs are indexed.
The page-indexing summary (last updated September 4) listed 36 indexed and 35
excluded URLs. The exclusions are not 35 broken marketing pages: they include
17 working redirects, four intentional noindex URLs, the API hostname root's
404, one old HTTP canonical duplicate, nine discovered core pages, and three
crawled entries (an intentional noindex guide, an old HTTP URL, and the
indexable English e-invoice guide).

Google live inspection found `/en/logistics/efaktura/` and `/ru/about/`
eligible for indexing; `/en/logistics/stats/` was fetched successfully but
correctly excluded by noindex. Eligibility is not proof of inclusion in the
index. Both sitemap submissions were successful and reported 45 URLs.

All eight full-body identity probes and the strict edge check passed from the
Mac on September 8. Identity and gzip homepage probes also completed from
both Mac and backend host. The previous partial-body failure did not reproduce;
its cause is still unconfirmed. Do not attribute the GSC backlog to WAF or that
network observation without crawler-specific evidence.

Approved local follow-up aligns header/footer logo home links with SR/EN/RU
and aligns each e-Faktura SoftwareApplication URL with its slash canonical.
The build SEO gate now verifies both rendered logo links on all 60 HTML pages
and application URLs on the three landing pages. Regression checks failed on
the original output before these fixes. Deployment is a separate verification
step; local validation alone does not establish production delivery.

Targeted indexing requests are limited to `/en/logistics/efaktura/`,
`/en/dodaj-biznis/`, and `/ru/about/`. Record UI acceptance separately from
actual indexing; do not resubmit repeatedly or validate intentional exclusions.
Notion synchronization remains pending authorization.

Submission evidence on September 8:

- `/en/logistics/efaktura/`: GSC confirmed the indexing request was sent and
  the URL was added to the priority crawl queue. Actual indexing is not confirmed.
- `/en/dodaj-biznis/`: GSC returned an indexing-submission error and asked to
  retry later. No successful submission is claimed; no immediate retry was made.
- `/ru/about/`: GSC confirmed the indexing request was sent and the URL was
  added to the priority crawl queue. Actual indexing is not confirmed. Its
  later index-view status said URL unknown, unlike the earlier discovered
  status; the successful live eligibility test is a separate observation.

Local verification: `npm test` (113 passing tests), `npm run check:types`
(125 files, zero diagnostics), `npm run build`, `npm run check:seo` (60 pages,
59 redirects, 45 sitemap URLs), and `git diff --check` passed. Existing build
warnings about Shiki inline styles/CSP and Node punycode remain; they were not
introduced or changed in this follow-up. At the local-validation checkpoint,
no commit, push, PR, deploy, or WAF change had been made. The subsequent
commit/push/PR/merge/deploy sequence was explicitly approved; record its exact
merged SHA and successful postdeploy evidence in the release PR. WAF changes
are not part of this release.

Independent read-only review: GO; rendered SR/EN/RU logo destinations and
application URLs were verified, and the static SEO check passed independently.
Requested reviewer routing was Terra/max; the available agent listing did not
expose runtime model/effort evidence. No reviewer writes were made.
