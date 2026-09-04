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
