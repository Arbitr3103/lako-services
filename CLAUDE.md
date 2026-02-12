# lako.services

Business automation website (Telegram/Viber bots) for Lako Services, Novi Sad, Serbia.

## Commands

- `npm run dev` — Development server (localhost:4321)
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Tech Stack

Astro 5 (SSR) + React islands + Tailwind CSS v4 + TypeScript, deployed on Cloudflare Pages.

## Architecture

| Path | Purpose |
|------|---------|
| `src/pages/` | SR pages (default locale, no prefix) |
| `src/pages/en/` | EN pages (`/en/` prefix) |
| `src/pages/ru/` | RU pages (`/ru/` prefix) |
| `src/pages/api/` | API routes (contact form) |
| `src/components/` | Astro components (Header, Footer, Logo, CTA) |
| `src/components/react/` | React islands (`client:load`) |
| `src/layouts/` | BaseLayout with SEO, hreflang, OG, JSON-LD |
| `src/i18n/` | Translations (sr.json, en.json, ru.json) + utils.ts |
| `src/styles/` | global.css (Tailwind v4 @theme) |

## Key Patterns

**i18n**: SR is default (no URL prefix `/`), EN at `/en/`, RU at `/ru/`. Use `t()` and `tObject()` from `src/i18n/utils.ts`. Every page needs SR, EN and RU versions.

**Tailwind v4**: CSS-first config via `@theme` in global.css. NOT using `@astrojs/tailwind` — uses `@tailwindcss/vite` plugin instead.

**React islands**: Only for interactive components (ContactForm). Use `client:load` directive in .astro files. Framer Motion only works inside React components, not in .astro.

**Colors**: Primary `#2563EB` (blue), Accent `#D97706` (orange CTA), Text `#1F2937`.

**Cloudflare Pages env vars**: `import.meta.env` НЕ работает для server-side переменных на Cloudflare Pages runtime. Используй `astro:env/server`: определи schema в `astro.config.mjs` → `envField.string({ context: 'server', access: 'secret' })`, импортируй через `import { VAR } from 'astro:env/server'` или `getSecret('VAR')`.

**Contact form**: React island → POST `/api/contact` → Resend email + Telegram Bot notification.

**Registration form**: `/dodaj-biznis` → POST `/api/register-business` → lako-bot API (creates tenant with pending status) + Resend email + Telegram notification. Admin approves in @LakoAdminBot.

**Telegram bots**: Catalog bot = `@LakoBot` (`t.me/LakoBot`), Admin bot = `@LakoAdminBot` (`t.me/LakoAdminBot`). Links used in small-business pages, i18n texts, and Footer.

**Anchor links**: Small-business hero CTA scrolls to `#how-it-works` section on the same page (not a navigation link).

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

- **Platform**: Cloudflare Pages (SSR via `@astrojs/cloudflare`)
- **Repo**: github.com/Arbitr3103/lako-services
- **Domain**: lako.services (DNS via Cloudflare)
- **Node**: 20 (see .nvmrc)

## GDPR / Legal

- **Privacy Policy** (`/privacy-policy`): 15 sections including bot data, GPS tracking, data request procedure
- **Cookie Policy** (`/cookie-policy`): sections + structured cookie table (essential + analytics)
- **Terms of Service** (`/terms-of-service`)
- **Cookie Banner** (`CookieBanner.astro`): Accept/Reject/Settings. Settings panel with analytics toggle. localStorage: `cookie-consent` = `accepted`|`rejected`|`custom`, `cookie-analytics` = `true`|`false`

## SEO

Every page has: title, description, hreflang (SR+EN+RU), OG tags, canonical URL. BaseLayout includes LocalBusiness JSON-LD structured data.
