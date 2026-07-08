# Terrerov — Web Design Studio

Pixel-perfect implementation of the Terrerov premium web design (from handoff) built in **Astro + Tailwind CSS**.

Ready for static deployment on **Cloudflare Pages**.

## Features
- Exact visual match to the provided design prototype
- Fixed nav with backdrop blur
- Subtle animated topographic canvas background (particles + contour lines)
- Responsive grid layouts, typography, and spacing
- Scroll-reveal animations (respect reduced motion)
- Fully functional contact form (opens mailto with prefilled body)
- Bilingual (English + Spanish)
- Static output, zero runtime dependencies

## Project Structure

```
/
├── public/                 # static assets (favicon)
├── src/
│   ├── components/
│   │   └── BackgroundCanvas.astro
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── wrangler.jsonc
└── package.json
```

## 🧞 Commands

| Command           | Action                                      |
|-------------------|---------------------------------------------|
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Local dev server (http://localhost:4321)    |
| `npm run build`   | Production build → `./dist/`                |
| `npm run preview` | Preview production build locally            |

## ☁️ Deploy to Cloudflare Pages (ready)

1. Build the site:
   ```bash
   npm run build
   ```

2. Deploy options:
   - **Via Wrangler (recommended)**:
     ```bash
     npx wrangler pages deploy dist/client
     ```
   - **Via GitHub + Cloudflare Pages dashboard**:
     - Connect your repo
     - Build command: `npm run build`
     - Build output directory: `dist/client`
     - Node version: 22

The project uses the official `@astrojs/cloudflare` adapter + `output: 'static'`.

After first deploy you can configure a custom domain (terrerov.com) in the Cloudflare dashboard.

## Design Source
Based on the handoff bundle `Terrerov_ Diseño web premium-handoff.zip` (read the README inside `design-handoff/`).

All styles, spacing, typography, interactions and canvas background were faithfully recreated.

## Next steps / Customization
- Replace placeholder images in the Works section with real client screenshots
- Add real testimonials (remove · placeholder)
- Wire the contact form to a real backend (e.g. Cloudflare Email Workers, Formspree, or Resend)
- Update social links in footer

Built for Terrerov.com — Louisville, KY.
