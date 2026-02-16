import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://lako.services',
  output: 'server',
  adapter: cloudflare(),
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
