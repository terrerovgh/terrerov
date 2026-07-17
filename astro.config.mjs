// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.terrerov.com',
  output: 'static',
  adapter: cloudflare(),
  integrations: [sitemap()],
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
