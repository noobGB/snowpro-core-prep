/// <reference types="node" />

/**
 * Guards the font stack against a silent fallback.
 *
 * WHY THIS EXISTS: issue #189 replaced the Google Fonts <link> with self-hosted
 * @fontsource-variable packages. Those packages declare their @font-face under the family names
 * "Inter Variable" and "JetBrains Mono Variable" — NOT "Inter" and "JetBrains Mono", which is what
 * tokens.css named at the time. So the webfonts loaded and were then never used: every element fell
 * through to system-ui.
 *
 * Nothing looked broken. The page still rendered in a clean sans-serif, and the obvious check —
 * measuring the h1 — showed identical dimensions before and after, because the h1 is a block
 * element whose width its container sets regardless of which font draws the glyphs. It was caught
 * only by measuring an unconstrained text probe against a system-ui probe in a real browser.
 *
 * A unit test cannot render text, but it can assert what actually went wrong: that the family names
 * in tokens.css match the ones the installed packages really declare. That is a string comparison,
 * and it is exactly the mismatch that caused the bug.
 *
 * Files are read with node:fs. Vite's `?raw` was the first attempt and does not work here: vitest
 * defaults to `css: false`, so Vite's CSS plugin resolves a `.css` import to an empty module before
 * `?raw` ever applies, and every assertion passed against "".
 *
 * The `/// <reference types="node" />` above scopes Node's types to THIS FILE. tsconfig.app.json
 * sets `types: ["vite/client"]` deliberately, so that browser source cannot reach for `process` or
 * `fs` by accident; widening it project-wide to satisfy one test would trade a real safeguard for
 * convenience.
 *
 * Reading the package's own CSS rather than hardcoding "Inter Variable" is deliberate: a hardcoded
 * expectation would keep passing if a future @fontsource release renamed the family, which is the
 * same class of failure over again.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not `new URL(...).pathname`: the latter leaves the path percent-encoded, so a
// directory containing a space resolves to a "%20" that does not exist on disk.
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string): string => readFileSync(path.join(APP_ROOT, rel), "utf8");

const tokensCss = read("src/styles/tokens.css");
const indexHtml = read("index.html");
const interCss = read("node_modules/@fontsource-variable/inter/index.css");
const monoCss = read("node_modules/@fontsource-variable/jetbrains-mono/index.css");

function declaredFamily(css: string, label: string): string {
  const match = /font-family:\s*'([^']+)'/.exec(css);
  if (!match) throw new Error(`No font-family found in ${label}`);
  return match[1] as string;
}

function tokenValue(name: string): string {
  const match = new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m").exec(tokensCss);
  if (!match) throw new Error(`No ${name} in tokens.css`);
  return (match[1] as string).trim();
}

/** First family in a CSS font stack, quotes stripped. That is the one that actually gets used when
 *  it resolves, so it is the only position this test cares about. */
function firstFamily(stack: string): string {
  return (stack.split(",")[0] as string).trim().replace(/^["']|["']$/g, "");
}

describe("font stack", () => {
  it("--font-sans leads with the family @fontsource-variable/inter actually declares", () => {
    expect(firstFamily(tokenValue("--font-sans"))).toBe(declaredFamily(interCss, "@fontsource-variable/inter"));
  });

  it("--font-mono leads with the family @fontsource-variable/jetbrains-mono actually declares", () => {
    expect(firstFamily(tokenValue("--font-mono"))).toBe(
      declaredFamily(monoCss, "@fontsource-variable/jetbrains-mono"),
    );
  });

  it("keeps a real fallback after the webfont", () => {
    // If the webfont fails to load -- blocked, cached oddly, a bad deploy -- the next entry is what
    // people actually read. A single-entry stack would silently become the browser default.
    for (const name of ["--font-sans", "--font-mono"]) {
      const families = tokenValue(name).split(",").map((f) => f.trim());
      expect(families.length, `${name} has no fallback`).toBeGreaterThan(1);
    }
  });

  it("loads no fonts from a third-party origin", () => {
    // Issue #189's whole point: every visitor's IP went to Google before they agreed to anything,
    // and Google Fonts was the last external origin in the CSP. tokens.css is where the faces come
    // from now, so a URL reappearing in either file undoes it.
    expect(tokensCss).not.toMatch(/https?:\/\//);
    expect(indexHtml).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
