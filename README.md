# Terrerov

Premium single-page site for **Terrerov Studio** — independent web design for small businesses.

Live: [www.terrerov.com](https://www.terrerov.com)

## Stack

- [Astro](https://astro.build) 7 (static output)
- Vanilla CSS (paper / ink editorial system)
- Interactive Temple of Heaven curtain → scannable QR (`uqr`)
- Deploy: Cloudflare Pages / Workers via `@astrojs/cloudflare`

## Features

- Conversion-focused sections: about, services, audience, process, FAQ, contact
- Bilingual positioning (English · Español)
- SEO: meta, Open Graph, JSON-LD (ProfessionalService + FAQPage), sitemap, robots.txt
- Accessible: skip link, focus styles, reduced-motion support
- Contact form via FormSubmit (mailto fallback offline)
- Security + cache headers for Cloudflare (`public/_headers`)

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Build output for Cloudflare: `dist/client`.

## Project structure

```
src/
  components/   # Page sections
  data/site.ts  # Copy & structured content
  layouts/      # Document shell (meta, schema)
  pages/        # Routes
  scripts/      # Curtain physics (client)
  styles/       # Global design system
public/         # Static assets, robots, headers, OG image
```

## Deploy (Cloudflare Pages)

1. Connect this repo to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist/client`
4. Custom domain: `www.terrerov.com`

## Credits

Temple assets and curtain interaction model adapted from
[CodeMaryy/temple-of-heaven-curtain](https://github.com/CodeMaryy/temple-of-heaven-curtain).
