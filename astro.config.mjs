// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://www.terrerov.com',
  output: 'static',
  adapter: cloudflare(),
});
