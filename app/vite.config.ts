/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, createReadStream } from "node:fs";
import path from "node:path";

// vite's normal `public/` -> unhashed root-URL copy is unavailable here since publicDir is
// repurposed below (content pipeline output) -- a handful of files still need a fixed, un-hashed
// root URL regardless (LandingPage.tsx's <img>, index.html's literal Open Graph <meta> content an
// OG tag's, which Vite doesn't rewrite the way it would a JS import, and the two favicon <link>
// tags), so each is copied by hand at the end of the build instead of going through Vite's normal
// asset pipeline.
// `contentType` below is consumed ONLY by configureServer (the `vite dev` path). In production
// express.static(DIST_DIR) infers the type from the file extension instead -- it still has to be
// correct here so local dev matches what the deployment actually serves.
const ROOT_ASSETS: Array<{ src: string; urlPath: string; contentType: string }> = [
  { src: "src/assets/landing-dashboard.png", urlPath: "/landing-dashboard.png", contentType: "image/png" },
  // Issue #158: the Open Graph card. Separate from landing-dashboard.png on purpose -- that one is
  // rendered in-page by HomePage.tsx at its natural 1280x860, which is a different job from a
  // social card cut at 1.91:1. Regenerate with `cd marketing/video && npm run og`.
  { src: "src/assets/og-card.png", urlPath: "/og-card.png", contentType: "image/png" },
  { src: "public/favicon.svg", urlPath: "/favicon.svg", contentType: "image/svg+xml" },
  { src: "public/favicon.ico", urlPath: "/favicon.ico", contentType: "image/x-icon" },
  // Issue #153: /robots.txt previously fell through to the SPA catch-all in server.ts, so a
  // crawler asking for crawl directives got index.html back with a 200 and Content-Type
  // text/html -- a false positive that looks fine in a browser and is useless to a robot.
  { src: "public/robots.txt", urlPath: "/robots.txt", contentType: "text/plain; charset=utf-8" },
];

function copyRootAssets(): Plugin {
  const resolved = ROOT_ASSETS.map((a) => ({ ...a, absSrc: path.resolve(import.meta.dirname, a.src) }));
  return {
    name: "copy-root-assets",
    closeBundle() {
      for (const a of resolved) {
        copyFileSync(a.absSrc, path.resolve(import.meta.dirname, "dist" + a.urlPath));
      }
    },
    // `vite dev` never runs closeBundle -- serve the same fixed paths directly from source so
    // e.g. HomePage.tsx's <img src="/landing-dashboard.png"> and index.html's favicon <link> tags
    // also resolve during local iteration, instead of silently falling through to the SPA's own
    // index.html (Vite's dev-server history-fallback matches any unmatched path, including these).
    configureServer(server) {
      for (const a of resolved) {
        server.middlewares.use(a.urlPath, (_req, res) => {
          const stream = createReadStream(a.absSrc);
          // Without this, a missing/deleted source file throws an unhandled ENOENT that crashes
          // the whole dev server process (not just this one request) -- confirmed reproducible via
          // `rm src/assets/landing-dashboard.png && npm run dev`, hit the URL. 404 instead, matching
          // how the production path (express.static in server.ts) already fails on a missing file.
          stream.on("error", (err) => {
            console.error(`Failed to serve ${a.urlPath} from ${a.absSrc}:`, err);
            if (!res.headersSent) res.writeHead(404);
            res.end();
          });
          res.setHeader("Content-Type", a.contentType);
          stream.pipe(res);
        });
      }
    },
  };
}

// Serves the content pipeline's output (../content/content.json, ../content/notes/*.json,
// ../content/search-index.json) at the site root, so the SPA can fetch it without a copy step.
// The eventual Docker setup (spec §9) will serve these from /app/dist the same way.
export default defineConfig({
  plugins: [react(), copyRootAssets()],
  publicDir: path.resolve(import.meta.dirname, "../content"),
  build: {
    // Never inline font files. Vite's default inlines any asset under 4 KB as a data: URI, and one
    // JetBrains Mono subset falls under it -- which produced a real CSP violation once issue #189
    // tightened font-src to 'self', because a data: URI is not 'self'.
    //
    // Loosening the CSP to `font-src 'self' data:` would have been the smaller diff and the wrong
    // trade: the whole point of that issue was getting to a policy with no exceptions in it. Not
    // inlining is also better on its own terms -- base64 is ~33% larger than the binary, it lands
    // in the render-blocking CSS instead of a separately cacheable file, and it is re-downloaded
    // whenever any unrelated style changes.
    assetsInlineLimit: (filePath) => (/\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined),
  },
  test: {
    // Today's suite only covers pure src/lib/*.ts (no DOM). Switch to "jsdom" (per-file via a
    // docblock, or globally here) if a future test needs to render a component.
    environment: "node",
  },
});
