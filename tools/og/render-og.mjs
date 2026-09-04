/**
 * Renders og-card.html to a 1200x630 PNG (issue #158).
 *
 * The Open Graph card is generated from HTML rather than exported from a design tool so it can be
 * re-rendered by running a script. The card carries the product name, tagline and brand colours,
 * all of which change; an exported bitmap that nobody can edit goes stale silently and is the
 * reason the previous card was a centre-crop of an unrelated screenshot.
 *
 * Writes straight into app/src/assets/, because ROOT_ASSETS in app/vite.config.ts copies from there
 * to the dist root at build time. The PNG is committed -- the app's build must not depend on
 * Playwright being installed.
 *
 * Its own package rather than a script in app/ or pipeline/: this needs Playwright and a browser
 * download, which has no business in the three packages CI installs on every run.
 *
 * Usage:
 *   cd tools/og && npm run setup   # once
 *   npm run og
 */

import { chromium } from "playwright";
import path from "node:path";
import { existsSync } from "node:fs";

const HERE = import.meta.dirname;
const SOURCE = path.resolve(HERE, "og-card.html");
const OUT = path.resolve(HERE, "../../app/src/assets/og-card.png");

// LinkedIn, Slack and X cut summary_large_image cards at ~1.91:1. 1200x630 is that ratio and is the
// size every one of them documents, so the card is never scaled or cropped by the platform.
const WIDTH = 1200;
const HEIGHT = 630;

async function main() {
  if (!existsSync(SOURCE)) throw new Error(`Missing ${SOURCE}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    // 1 rather than 2: the output must be exactly 1200x630. A retina factor would produce a
    // 2400x1260 file that still *claims* 1200x630 in the meta tags -- larger for no benefit, since
    // these cards are displayed at roughly 500px wide anyway.
    deviceScaleFactor: 1,
  });

  await page.goto(`file://${SOURCE.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
  // Fonts resolve locally or fall back; waiting on the font set avoids screenshotting mid-swap,
  // which shows up as subtly wrong letter-spacing in the final PNG.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  await browser.close();

  console.log(`Wrote ${OUT} (${WIDTH}x${HEIGHT})`);
  console.log("Check it at ~500px wide before shipping -- that is the size it renders at in a feed.");
}

main().catch((err) => {
  console.error("OG render failed:", err.message);
  process.exit(1);
});
