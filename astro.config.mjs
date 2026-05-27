import { defineConfig, sessionDrivers } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import { isSitemapIncludedPath } from './src/utils/seo-policy.js';

export default defineConfig({
  site: 'https://lako.services',
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  // The app does not use server sessions. Keep deployment free of implicit KV
  // provisioning; switch to cloudflareKVBinding before adding auth/session state.
  session: {
    driver: sessionDrivers.lruCache(),
  },
  security: {
    csp: {
      scriptDirective: {
        resources: ["'self'", "https://static.cloudflareinsights.com"],
      },
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      },
      directives: [
        "default-src 'self'",
        "font-src 'self' https://cdn.jsdelivr.net",
        "img-src 'self' data:",
        "connect-src 'self' https://bot.lako.services https://static.cloudflareinsights.com https://cloudflareinsights.com",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => isSitemapIncludedPath(new URL(page).pathname),
      i18n: {
        defaultLocale: 'sr',
        locales: {
          sr: 'sr',
          en: 'en',
          ru: 'ru',
        },
      },
    }),
  ],
  i18n: {
    defaultLocale: 'sr',
    locales: ['sr', 'en', 'ru'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
