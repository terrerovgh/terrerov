# Terrerov — Web Design Studio

**GitHub:** https://github.com/terrerov/terrerov  
**Target live site:** https://www.terrerov.com

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

## ☁️ Deploy to Cloudflare Pages

This project is pre-configured for **Cloudflare Pages** (static output via `@astrojs/cloudflare` adapter).

### Recommended: GitHub + Cloudflare Pages (auto-deploy on push)

1. Go to the [Cloudflare Pages dashboard](https://dash.cloudflare.com/?to=/:account/pages).
2. **Create a project** → **Connect to Git**.
3. Authorize GitHub if needed and select the repository **`terrerov/terrerov`**.
4. Configure build settings:
   - **Framework preset**: Astro (or leave as "None")
   - **Build command**: `npm run build`
   - **Build output directory**: `dist/client`
   - **Root directory**: `/` (default)
   - **Node.js version**: `22` (or "Latest")
5. Click **Save and Deploy**.

Future pushes to `main` will automatically trigger new deployments.

### Alternative: Manual deploy with Wrangler

```bash
npm install
npm run build
npx wrangler pages deploy dist/client --project-name=terrerov
```

(Requires `wrangler login` the first time.)

The project uses:
- `output: 'static'`
- `adapter: cloudflare()`
- `wrangler.jsonc` with assets pointing to `./dist/client`

### Custom Domain: www.terrerov.com

Once you have a successful deployment (visible on a `*.pages.dev` URL):

1. Open your Pages project in the Cloudflare dashboard.
2. Go to **Custom domains** tab.
3. Click **Add domain** and type `www.terrerov.com`.
4. If your domain `terrerov.com` is already added to this Cloudflare account:
   - Cloudflare will auto-propose the DNS records (usually a `CNAME` record for `www` pointing to your Pages project hostname).
   - Confirm and add them.
5. Wait for DNS propagation (usually < 1 minute on Cloudflare) and SSL certificate provisioning (free and automatic).
6. Visit **https://www.terrerov.com** — it should be live.

**Tips:**
- You can also add the apex (`terrerov.com`) and configure a Page Rule or redirect from root → www.
- Make sure the domain is active in your Cloudflare account (DNS, not just registrar).
- After domain is added, you can remove the default `.pages.dev` hostname if desired.

## Design Source
Based on the handoff bundle `Terrerov_ Diseño web premium-handoff.zip` (read the README inside `design-handoff/`).

All styles, spacing, typography, interactions and canvas background were faithfully recreated.

## Next steps / Customization
- Replace placeholder images in the Works section with real client screenshots
- Add real testimonials (remove · placeholder)
- Wire the contact form to a real backend (e.g. Cloudflare Email Workers, Formspree, or Resend)
- Update social links in footer

Built for Terrerov.com — Louisville, KY.
