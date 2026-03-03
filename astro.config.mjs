import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://lako.services',
  output: 'server',
  adapter: cloudflare(),
  experimental: {
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
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    react(),
    sitemap({
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
