# Terrerov

Premium horizontal studio site for **Terrerov** — independent web design for small businesses.

Live: [www.terrerov.com](https://www.terrerov.com)

## Experience

- **Horizontal scroll** powered by GSAP ScrollTrigger (vertical wheel → horizontal panels)
- **Mobile app shell** (tabs + FAB) under ~900px
- Interactive Temple of Heaven curtain (QR to terrerov.com)
- Featured personal project: **Surviving Chernarus** (life OS / Beacon lab)
- Premium motion: scrubbed track, staggered reveals, magnetic buttons
- Fixed chrome: progress rail, section index, active nav
- Keyboard: ← → between panels
- Reduced-motion / fallback: vertical layout with soft reveals

## Stack

- Astro 7 (static) + Cloudflare Pages
- GSAP 3 + ScrollTrigger + ScrollToPlugin
- Vanilla CSS (paper / ink system)
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

Output: `dist/client`

## Structure

```
src/
  components/   # Full-viewport panels
  data/site.ts  # Copy
  layouts/      # Document shell
  pages/        # Routes
  scripts/      # curtain.ts + horizontal.ts (GSAP)
  styles/       # Design system
```

## Credits

Temple assets adapted from
[CodeMaryy/temple-of-heaven-curtain](https://github.com/CodeMaryy/temple-of-heaven-curtain).
