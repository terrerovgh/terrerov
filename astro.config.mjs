// @ts-check
import { defineConfig } from "astro/config";

// The site is one page of hand-drawn canvas. Astro is here for the build, not
// for a framework: it hashes the bundle so the assets can be cached forever,
// and keeps the CV markup as plain server-rendered HTML.
export default defineConfig({
  site: "https://terrerov.com",
  compressHTML: true,
  build: {
    // Inlined CSS would need 'unsafe-inline' in the CSP. It stays a file.
    inlineStylesheets: "never",
  },
});
