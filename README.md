# A line

A charcoal figure walks a cardboard timeline. It is my CV.
Live at [terrerov.com](https://terrerov.com).

Nothing is loaded from anywhere else: the paper, the walker, the scenery and
every letter are drawn into a canvas at runtime. There is no font file — the
alphabet in `src/scripts/alphabet.js` is stroke data, so no two letters come
out the same shape.

## Run it

```bash
npm install
npm run dev
```

`npm run build` writes `dist/`, `npm run preview` serves that build.

`?p=0.5` freezes the walk at a given point (0 to 1), which is how the frames
get checked.

Arrow keys, Page Up/Down and Home/End jump from stop to stop.

## Layout

Astro is here for the build, not for a framework. One page, server-rendered to
plain HTML, with the drawing bundled as a single hashed module.

```
src/pages/index.astro   the page, and the CV as real text for crawlers
src/styles/global.css   the little CSS there is
public/                 copied verbatim: _headers, robots.txt, favicon

src/scripts/charcoal.js   stroke engine, kraft paper, grain, hatching
src/scripts/alphabet.js   ~80 glyphs as pen strokes
src/scripts/lettering.js  writing: per-letter variation, write-on reveal
src/scripts/journey.js    scroll -> where he is (walk, then pause, then walk)
src/scripts/character.js  skeleton, gait, idle
src/scripts/costumes.js   garments, hats and props per stage
src/scripts/scenery.js    one composed vignette per stage
src/scripts/stages.js     the content
src/scripts/main.js       compositing, tile caching, the frame loop
```

`assets/` is reference art used while drawing. It is not part of the site and
is not committed.

## Deploying

Cloudflare Pages, from `main`:

| | |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `.nvmrc` (22.12.0) |

`wrangler.toml` declares the output directory too, so the dashboard can pick it
up on its own. `public/_headers` sets the cache and security headers: the
bundle is content-hashed and pinned for a year, the HTML always revalidates.
