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
| `src/pages/api/` | API routes (contact form) |
| `src/components/` | Astro components (Header, Footer, Logo, CTA) |
| `src/components/react/` | React islands (`client:load`) |
| `src/layouts/` | BaseLayout with SEO, hreflang, OG, JSON-LD |
| `src/i18n/` | Translations (sr.json, en.json) + utils.ts |
| `src/styles/` | global.css (Tailwind v4 @theme) |

## Key Patterns

**i18n**: SR is default (no URL prefix `/`), EN at `/en/`. Use `t()` and `tObject()` from `src/i18n/utils.ts`. Every page needs both SR and EN versions.

**Tailwind v4**: CSS-first config via `@theme` in global.css. NOT using `@astrojs/tailwind` — uses `@tailwindcss/vite` plugin instead.

**React islands**: Only for interactive components (ContactForm). Use `client:load` directive in .astro files. Framer Motion only works inside React components, not in .astro.

**Colors**: Primary `#2563EB` (blue), Accent `#D97706` (orange CTA), Text `#1F2937`.

**Contact form**: React island → POST `/api/contact` → Resend email + Telegram Bot notification.

## Environment Variables

```
RESEND_API_KEY=re_xxxxx        # Resend transactional email
TELEGRAM_BOT_TOKEN=xxxxx       # Telegram Bot API notifications
TELEGRAM_CHAT_ID=xxxxx         # Telegram chat for notifications
PUBLIC_SITE_URL=https://lako.services
```

## Deployment

- **Platform**: Cloudflare Pages (SSR via `@astrojs/cloudflare`)
- **Repo**: github.com/Arbitr3103/lako-services
- **Domain**: lako.services (DNS via Cloudflare)
- **Node**: 20 (see .nvmrc)

## SEO

Every page has: title, description, hreflang (SR+EN), OG tags, canonical URL. BaseLayout includes LocalBusiness JSON-LD structured data.
