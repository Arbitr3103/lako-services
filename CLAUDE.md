# lako.services

Business automation website (Telegram bots) for Lako Services, Novi Sad, Serbia.

## Commands

- `npm run dev` — Development server (localhost:4321)
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Tech Stack

Astro 5 (SSR) + React islands + Tailwind CSS v4 + TypeScript, deployed on Cloudflare Workers.

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
| `src/components/efaktura/` | Studio React SPA (Studio.tsx, InvoiceForm, LivePreview, ItemsTable) |
| `src/layouts/` | BaseLayout with SEO, hreflang, OG, JSON-LD |
| `src/i18n/` | Translations (sr.json, en.json, ru.json) + utils.ts |
| `src/styles/` | global.css (Tailwind v4 @theme) |

## Key Patterns

**i18n**: SR is default (no URL prefix `/`), EN at `/en/`, RU at `/ru/`. Use `t()` and `tObject()` from `src/i18n/utils.ts`. Every page needs SR, EN and RU versions.

**Tailwind v4**: CSS-first config via `@theme` in global.css. NOT using `@astrojs/tailwind` — uses `@tailwindcss/vite` plugin instead.

**React islands**: Only for interactive components (ContactForm). Use `client:load` directive in .astro files. Framer Motion only works inside React components, not in .astro.

**Colors**: Primary `#2563EB` (blue), Accent `#D97706` (orange CTA), Text `#1F2937`.

**Cloudflare Workers env vars**: `import.meta.env`, `astro:env/server` static imports, и `getSecret()` — все НЕ работают для secrets на CF Workers runtime. Единственный рабочий способ: `(locals as any).runtime.env.VAR_NAME` (прямой доступ к CF bindings в API routes). `[vars]` из wrangler.toml работают через тот же путь. Секреты задаются через `echo "VALUE" | npx wrangler secret put KEY`. Для локальной разработки — `.dev.vars`.

**Contact form**: React island → POST `/api/contact` → Resend email (`noreply@lako.services` → `info@lako.services`) + Telegram Bot notification. Returns error if both channels fail.

**Registration form**: `/dodaj-biznis` → POST `/api/register-business` → lako-bot API (creates tenant with pending status) + Resend email + Telegram notification. Admin approves in @LakoAdminBot.

**Resend email**: Domain `lako.services` verified in Resend (DKIM + SPF). From: `noreply@lako.services`, To: `info@lako.services`. Region: eu-west-1.

**Telegram bots**: Catalog bot = `@LakoBot` (`t.me/LakoBot`), Admin bot = `@LakoAdminBot` (`t.me/LakoAdminBot`). Used in small-business pages and i18n. Footer/contact link = `t.me/Bragin_Arbitr` (personal).

**Anchor links**: Small-business hero CTA scrolls to `#how-it-works` section on the same page (not a navigation link). Logistics hero secondary CTA scrolls to `#bot-section`.

**Logistics page** (`/logistics`): 12 sections focused on transport bot product. Hero CTA links directly to `t.me/lakoprevoz_bot`. Bot section (Section 9) has: video + CMR screenshot grid → bot card → feature grid with guide links → pricing. Final CTA also links to Telegram bot (not contact page). No "coming soon" features — only working functionality. CMR screenshot needs `bg-white` container (dark theme readability).

**e-Faktura Studio** (`/efaktura`): Landing page (pure Astro) + `/efaktura/studio` (React SPA via `client:load`). Split-screen invoice builder: form left, live PDF preview right. Generates SEF-compliant PDF + UBL 2.1 XML. Backend on lako-bot (`POST /api/efaktura/*`). Feature flags: `{ ai: false, excel: false, sef: false }`. SoftwareApplication JSON-LD for SEO.

**Trust banner**: Green gradient card with shield icon + 4 security bullet points + link to `/zastita-podataka`. Present on: efaktura landing, small-business, logistics pages (all 3 locales). i18n keys: `efaktura.trustBanner.*`, `smallBusiness.trustBanner.*`.

**Analytics**: `trackEvent()` in Studio.tsx — gtag + sendBeacon. Events: `efaktura_studio_open`, `efaktura_generate_start`, `efaktura_generate_success`, `efaktura_download`.

**CORS**: efaktura API routes (`/api/efaktura/*`) have origin restriction — only `lako.services` and `localhost:4321` allowed.

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
- **Node**: 20 (see .nvmrc)
- **Deploy**: `npm run deploy` (builds Astro + deploys Worker via wrangler)
- **Preview**: `npm run preview` (builds + runs local Worker on :8787)
- **Auto-deploy**: Workers Builds — push to `main` triggers build+deploy (see setup below)
- **Secrets**: set via `npx wrangler secret put <NAME>` (RESEND_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, REGISTRATION_SECRET)
- **Observability**: enabled in wrangler.toml — logs/traces in Workers dashboard
- **Worker route**: `lako.services/*` → `lako-services` (DNS A record 192.0.2.1 proxied)

### Workers Builds Setup (one-time, via Dashboard)

1. CF Dashboard → Workers & Pages → `lako-services` → Settings → Builds
2. Connect to GitHub → `Arbitr3103/lako-services`
3. Build command: `npm run build`, Deploy command: `npx wrangler deploy`, Branch: `main`
4. Save and Deploy

### Post-migration Cleanup (23.02.2026 — after 1 week stable)

1. Delete staging Worker: `CLOUDFLARE_API_TOKEN=xxx npx wrangler delete --name lako-services-staging`
2. Disconnect Pages from GitHub: CF Dashboard → Pages → `lako-services` → Settings → Build → Disconnect
3. Delete Pages project: `CLOUDFLARE_API_TOKEN=xxx npx wrangler pages project delete lako-services`
4. Remove this cleanup section from CLAUDE.md

## GDPR / Legal

- **Privacy Policy** (`/privacy-policy`): 15 sections including bot data, GPS tracking, data request procedure
- **Cookie Policy** (`/cookie-policy`): sections + structured cookie table (essential + analytics)
- **Terms of Service** (`/terms`)
- **Cookie Banner** (`CookieBanner.astro`): Accept/Reject/Settings. Settings panel with analytics toggle. localStorage: `cookie-consent` = `accepted`|`rejected`|`custom`, `cookie-analytics` = `true`|`false`

## SEO

Every page has: title, description, hreflang (SR+EN+RU), OG tags, canonical URL. BaseLayout includes LocalBusiness JSON-LD structured data. BaseLayout supports optional `ogImage` and `jsonLd` props for per-page overrides.
