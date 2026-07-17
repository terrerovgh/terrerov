# Terrerov

Single-view studio site — interactive Temple QR curtain is the whole experience.

Live: [www.terrerov.com](https://www.terrerov.com)

## Experience

- Full-viewport Temple of Heaven curtain (live QR → terrerov.com)
- One fixed frame: **no page scroll**
- Condensed studio info overlaid (services, process, contact)
- Play panel for curtain physics / roof study

## Stack

- Astro 7 static + Cloudflare Pages (`dist/client`)
- Vanilla CSS (paper / ink)
- `uqr` for the live QR curtain

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

## Structure

```
src/
  data/site.ts     # copy
  layouts/         # document shell + SEO
  pages/index.astro
  scripts/curtain.ts
  styles/global.css
public/assets/     # temple + OG
```

## Credits

Temple assets adapted from
[CodeMaryy/temple-of-heaven-curtain](https://github.com/CodeMaryy/temple-of-heaven-curtain).
