/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, createReadStream } from "node:fs";
import path from "node:path";

// vite's normal `public/` -> unhashed root-URL copy is unavailable here since publicDir is
// repurposed below (content pipeline output) -- LandingPage.tsx's <img> and index.html's static
// Open Graph <meta> tags both need this one file at a fixed, un-hashed root path (an OG tag's
// content is literal text Vite doesn't rewrite, unlike a JS import it would hash), so it's copied
// by hand at the end of the build instead of going through Vite's normal asset pipeline.
function copyLandingScreenshot(): Plugin {
  const screenshotPath = path.resolve(import.meta.dirname, "src/assets/landing-dashboard.png");
  return {
    name: "copy-landing-screenshot",
    closeBundle() {
      copyFileSync(screenshotPath, path.resolve(import.meta.dirname, "dist/landing-dashboard.png"));
    },
    // `vite dev` never runs closeBundle -- serve the same fixed path directly from source so
    // LandingPage.tsx's <img src="/landing-dashboard.png"> also renders during local iteration.
    configureServer(server) {
      server.middlewares.use("/landing-dashboard.png", (_req, res) => {
        res.setHeader("Content-Type", "image/png");
        createReadStream(screenshotPath).pipe(res);
      });
    },
  };
}

// Serves the content pipeline's output (../content/content.json, ../content/notes/*.json,
// ../content/search-index.json) at the site root, so the SPA can fetch it without a copy step.
// The eventual Docker setup (spec §9) will serve these from /app/dist the same way.
export default defineConfig({
  plugins: [react(), copyLandingScreenshot()],
  publicDir: path.resolve(import.meta.dirname, "../content"),
  test: {
    // Today's suite only covers pure src/lib/*.ts (no DOM). Switch to "jsdom" (per-file via a
    // docblock, or globally here) if a future test needs to render a component.
    environment: "node",
  },
});
