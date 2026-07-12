# lako.services

Business automation website (Telegram bots) for Lako Services, Novi Sad, Serbia.

## Commands

- `npm run dev` — Development server (localhost:4321)
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Tech Stack

Astro 6 (SSR) + React islands + Tailwind CSS v4 + TypeScript, deployed on Cloudflare Workers.

## Architecture

| Path | Purpose |
|------|---------|
| `src/pages/` | SR pages (default locale, no prefix) |
| `src/pages/en/` | EN pages (`/en/` prefix) |
| `src/pages/ru/` | RU pages (`/ru/` prefix) |
| `src/pages/api/` | API routes (contact, register-business) |
| `src/pages/efaktura/` | e-Faktura Studio landing + app (SR) |
| `src/components/` | Astro components (Header, Footer, Logo, CTA) |
| `src/components/react/` | React islands (`client:load`) |
| `src/components/efaktura/` | Studio React SPA (Studio.tsx, InvoicePreview.tsx, types.ts) |
| `src/layouts/` | BaseLayout with SEO, hreflang, OG, JSON-LD |
| `src/i18n/` | Translations (sr.json, en.json, ru.json) + utils.ts |
| `src/styles/` | global.css (Tailwind v4 @theme) |

## Key Patterns

**i18n**: SR is default (no URL prefix `/`), EN at `/en/`, RU at `/ru/`. Use `t()` and `tObject()` from `src/i18n/utils.ts`. Every page needs SR, EN and RU versions.

**Tailwind v4**: CSS-first config via `@theme` in global.css. NOT using `@astrojs/tailwind` — uses `@tailwindcss/vite` plugin instead.

**React islands**: Only for interactive components (ContactForm). Use `client:load` directive in .astro files. Framer Motion only works inside React components, not in .astro.

**Colors**: Primary `#2563EB` (blue), Accent `#D97706` (orange CTA), Text `#1F2937`.

**Cloudflare Workers env vars**: Astro 6 / `@astrojs/cloudflare` v13 removed `locals.runtime.env`. Use `import { env } from "cloudflare:workers"` through `src/utils/worker-env.ts` for CF bindings in API routes. `import.meta.env`, `astro:env/server`, `getSecret()`, and old `(locals as any).runtime.env.VAR_NAME` access do NOT work for Workers runtime secrets. `[vars]` from `wrangler.toml` and secrets are available through `cloudflare:workers`. Secrets are set via `echo "VALUE" | npx wrangler secret put KEY`. For local Worker preview use `.dev.vars`.

**Contact form**: React island → POST `/api/contact` → Resend email (`noreply@lako.services` → `info@lako.services`) + Telegram Bot notification. Returns error if both channels fail.

**Registration form**: `/dodaj-biznis` → POST `/api/register-business` → lako-bot API (creates tenant with pending status) + Resend email + Telegram notification. Admin approves in @LakoAdminBot.

**Resend email**: Domain `lako.services` verified in Resend (DKIM + SPF). From: `noreply@lako.services`, To: `info@lako.services`. Region: eu-west-1.

**Telegram bots**: Catalog bot = `@LakoBot` (`t.me/LakoBot`), Admin bot = `@LakoAdminBot` (`t.me/LakoAdminBot`). Used in small-business pages and i18n. Footer/contact link = `t.me/Bragin_Arbitr` (personal).

**Anchor links**: Small-business hero CTA scrolls to `#how-it-works` section on the same page (not a navigation link). Logistics hero secondary CTA scrolls to `#bot-section`.

**Logistics page** (`/logistics`): 12 sections focused on transport bot product. Hero CTA links directly to `t.me/lakoprevoz_bot`. Bot section (Section 9) has: video + CMR screenshot grid → bot card → feature grid with guide links → pricing. Final CTA also links to Telegram bot (not contact page). No "coming soon" features — only working functionality. CMR screenshot needs `bg-white` container (dark theme readability).

**e-Faktura Studio** (`/efaktura`): Landing page (pure Astro) + `/efaktura/studio` (React SPA via `client:load`). Split-screen document builder: form left, live PDF preview right. **Two document types**: Faktura (invoice, PDF + UBL 2.1 XML) and Otpremnica (delivery note, PDF only, no XML). Segmented toggle at top of form switches type — preserves all form data (items, seller, buyer). Otpremnica: hides dueDate/paymentReference/bankAccount fields, shows transport section (vehicleRegistration, transportInfo, warehouseFrom, loadingPlace, unloadingPlace, loadingDateTime, transportPurpose) + signatures section (handoverName, receiverName). Copy-from-address buttons on loading/unloading place fields (copies seller/buyer address+city). **QR code** on preview (`qrcode.react` QRCodeSVG): 80x80px right-aligned in header, encodes document key data (number, PIB, date, total, vehicle reg for otpremnica). Label: "PROVERA DOKUMENTA" (otpremnica) / "QR KOD" (faktura). Preview-only — backend PDF uses verification URL with shareCode. 2 signature lines in preview ("Predao:" | "Primio:") with optional names underneath. Backend on lako-bot (`POST /api/efaktura/*`). Feature flags: `{ ai: false, excel: false, sef: false }`. SoftwareApplication JSON-LD for SEO. **Pricing CTA links**: free plan → `/efaktura/studio`, paid plans (Pro/Business) → `https://app.echain.world` (external, `_blank`). i18n: all Studio labels translated SR/EN/RU (including document type names, transport fields, logistics fields, signature labels). Freemium limit UI: `limit_anon`/`limit_free` states with upsell CTA. Types: `DocumentType = 'faktura' | 'otpremnica'` in `types.ts`, `createEmptyInvoice(documentType)` sets appropriate defaults. Landing page: 4 solution cards (split, check, download, qr) in `sm:grid-cols-2 lg:grid-cols-4` grid. FAQ includes otpremnica + QR questions. SEO text mentions "Zakon o prevozu tereta" and 2026 compliance.

**Trust banner**: Green gradient card with shield icon + 4 security bullet points + link to `/zastita-podataka`. Present on: efaktura landing, small-business, logistics pages (all 3 locales). i18n keys: `efaktura.trustBanner.*`, `smallBusiness.trustBanner.*`.

**Analytics**: Cloudflare Web Analytics (token `2332d731c66846b5b3d5471c5157bae1`) — JS snippet in `BaseLayout.astro` `<head>`. Provides: visits by country, page views, referrers, devices. Dashboard: Cloudflare → lako.services → Web Analytics. Enabled 2026-02-22. No client-side event tracking: the old gtag-based `trackEvent()` in Studio.tsx was dead code (no gtag loaded) and was removed 2026-07-12; if e-Faktura funnel events are needed, wire up GA4 (script + CSP + cookie consent) first. GraphQL API: `rumPageloadEventsAdaptiveGroups` (account-level, no siteTag filter needed).

**CORS**: efaktura API routes (`/api/efaktura/*`) live on the lako-bot backend (`bot.lako.services`), not in this repo; their origin restriction (only `lako.services` and `localhost:4321`) is configured there. This repo's own API routes (`/api/contact`, `/api/register-business`) enforce the same allowlist via `isAllowedOrigin()` in `src/utils/api-validation.ts`.

## Environment Variables

```
RESEND_API_KEY=re_xxxxx        # Resend transactional email
TELEGRAM_BOT_TOKEN=xxxxx       # Telegram Bot API notifications
TELEGRAM_CHAT_ID=xxxxx         # Telegram chat for notifications
PUBLIC_SITE_URL=https://lako.services
LAKO_BOT_API_URL=https://bot.lako.services  # lako-bot API for self-registration
REGISTRATION_SECRET=xxxxx                    # shared secret with lako-bot
```

## Deployment

- **Platform**: Cloudflare Workers (SSR via `@astrojs/cloudflare` adapter)
- **Repo**: github.com/Arbitr3103/lako-services
- **Domain**: lako.services (custom domain on Worker)
- **Node**: 22 (required by Astro 6)
- **Deploy**: `npm run deploy` (builds Astro + deploys Worker via wrangler)
- **Preview**: `npm run preview` (builds + runs local Worker on :8787)
- **Auto-deploy**: GitHub Actions (`.github/workflows/deploy.yml`) — push to `main` triggers build+deploy (~33s). Secret `CLOUDFLARE_API_TOKEN` set in GitHub repo settings.
- **Manual deploy**: `source ~/.nvm/nvm.sh && nvm use 22 && CLOUDFLARE_API_TOKEN=... npm run deploy`
- **Secrets**: set via `npx wrangler secret put <NAME>` (RESEND_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, REGISTRATION_SECRET)
- **Observability**: enabled in wrangler.toml — logs/traces in Workers dashboard
- **Worker route**: `lako.services/*` → `lako-services` (DNS A record 192.0.2.1 proxied)

### Pricing (small-business page)

- **Katalog**: бесплатно
- **Pro**: 2.500 RSD / месяц
- **Business**: 3.500 RSD / месяц
- Все локали (SR/EN/RU) в RSD. Цены в i18n JSON + FAQ текстах.

## GDPR / Legal

- **Privacy Policy** (`/privacy-policy`): 15 sections including bot data, GPS tracking, data request procedure
- **Cookie Policy** (`/cookie-policy`): sections + structured cookie table (essential + analytics)
- **Terms of Service** (`/terms`)
- **Cookie Banner** (`CookieBanner.astro`): Accept/Reject/Settings. Settings panel with analytics toggle. localStorage: `cookie-consent` = `accepted`|`rejected`|`custom`, `cookie-analytics` = `true`|`false`

## Security (hardened 2026-05-27)

- **CSP**: hash-based CSP via `security.csp` in `astro.config.mjs` (rendered as `<meta>` tag) — `default-src 'self'`, script/style/font/connect allowlists, `frame-ancestors 'none'`. `src/middleware.ts` sets the remaining security headers (HSTS, X-Frame-Options, etc.)
- **Security headers**: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (no camera/mic/geo), X-DNS-Prefetch-Control off
- **SRI**: `integrity` + `crossorigin="anonymous"` on CDN font stylesheets (Geist Sans/Mono)
- **External links**: all `target="_blank"` links have `rel="noopener noreferrer"`
- **API input validation**: `sanitize()` enforces string type + trim + maxLength, `sanitizeHeaderValue()` strips CR/LF for email subjects, `EMAIL_RE` format validation
- **Origin check**: API routes validate `Origin`/`Referer` header against allowlist
- **HTML escaping**: `escapeTgHtml()` on all user data in Telegram messages + Resend emails
- **Analytics consent**: CF Web Analytics beacon loads only after cookie consent accepted
- **Forms**: `autocomplete` + `maxLength` attributes on all input fields
- **robots.txt**: `Disallow: /api/`
- **No generator meta**: `<meta name="generator">` removed (no framework version disclosure)
- **Rate limiting**: In-memory per-IP rate limiter (`src/utils/rate-limit.ts`) with request-driven cleanup (no global timers in Worker scope). `/api/contact` 5 req/5min, `/api/register-business` 3 req/5min. Returns 429 + `Retry-After: 300`. Uses `cf-connecting-ip` header. Defence-in-depth only; real attack resistance requires Cloudflare WAF/rate limiting rules.
- **API body limits**: `/api/contact` and `/api/register-business` require `application/json`, stream-read max 8 KB, and return 413/415 before JSON parsing.
- **Registration fail-closed**: `/api/register-business` returns 503 if `REGISTRATION_SECRET` is missing.
- **e-Faktura local privacy**: seller/buyer/item localStorage persistence requires explicit local-device opt-in and has a clear-data control.
- **Security audit report**: `docs/security-audit-2026-05-27.md`; Notion record: `lako.services Project Database` / `2026-05-27 - Security audit and hardening`.

## SEO

Every page has: title, description, hreflang (SR+EN+RU), OG tags, canonical URL. BaseLayout includes LocalBusiness JSON-LD structured data. BaseLayout supports optional `ogImage` and `jsonLd` props for per-page overrides.
