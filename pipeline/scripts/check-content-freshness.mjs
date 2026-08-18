#!/usr/bin/env node
/**
 * Checks whether the live Snowflake documentation pages this study content was verified against
 * have changed since the stored baseline was last taken. This can't tell you *what* changed or
 * whether it invalidates any specific fact — it's a cheap, offline-friendly tripwire: "go
 * re-read this page by hand before trusting the notes/questions built from it."
 *
 * Usage (run from `pipeline/`):
 *   npm run check:freshness            # report changed/unchanged/unreachable pages
 *   npm run check:freshness -- --update  # after manually re-verifying, refresh the baseline
 *
 * See ../../SnowPro_Notes_and_Questions/CONTENT_FRESHNESS.md for the full explanation, the
 * manual re-verification checklist, and what to do when this reports a change.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(__dirname, "freshness-baseline.json");

function normalizeHtml(html) {
  // Strip script/style blocks (highest-noise, most volatile: build hashes, analytics, timestamps)
  // and all remaining tags, then collapse whitespace — a rough but stable proxy for "the visible
  // content of this page," good enough to detect a real edit without needing a full HTML parser.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashContent(text) {
  return createHash("sha256").update(text, "utf-8").digest("hex").slice(0, 16);
}

async function checkOne(entry) {
  try {
    const res = await fetch(entry.url, {
      headers: { "User-Agent": "Mozilla/5.0 (content-freshness-check; local study tool)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ...entry, status: "UNREACHABLE", detail: `HTTP ${res.status}` };
    const html = await res.text();
    const hash = hashContent(normalizeHtml(html));
    if (!entry.hash) return { ...entry, status: "NO_BASELINE", newHash: hash };
    return { ...entry, status: hash === entry.hash ? "UNCHANGED" : "CHANGED", newHash: hash };
  } catch (err) {
    return { ...entry, status: "UNREACHABLE", detail: err.message };
  }
}

async function main() {
  const update = process.argv.includes("--update");
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));

  console.log(`Checking ${baseline.pages.length} source pages against the baseline from ${baseline.lastUpdated}...\n`);
  const results = await Promise.all(baseline.pages.map(checkOne));

  const changed = results.filter((r) => r.status === "CHANGED");
  const unreachable = results.filter((r) => r.status === "UNREACHABLE");
  const unchanged = results.filter((r) => r.status === "UNCHANGED");

  for (const r of results) {
    const icon = { UNCHANGED: "✓", CHANGED: "⚠ CHANGED", UNREACHABLE: "✗ unreachable", NO_BASELINE: "· no baseline yet" }[r.status];
    console.log(`${icon}  ${r.label}`);
    if (r.status === "UNREACHABLE") console.log(`     ${r.detail}`);
  }

  console.log(`\n${unchanged.length} unchanged, ${changed.length} changed, ${unreachable.length} unreachable.`);

  if (changed.length > 0) {
    console.log(`\n⚠ ${changed.length} page(s) changed since ${baseline.lastUpdated}. This does NOT mean the`);
    console.log(`  study content is wrong — Snowflake edits docs pages constantly for typos, formatting,`);
    console.log(`  and additions unrelated to what's tested here. It means: open the changed page(s) and`);
    console.log(`  read the section(s) this repo's notes/questions actually cite, and compare by hand.`);
    console.log(`  See SnowPro_Notes_and_Questions/CONTENT_FRESHNESS.md for the full page-by-page map of`);
    console.log(`  which notes/questions each URL backs, and the manual re-verification checklist.`);
  }
  if (unreachable.length > 0) {
    console.log(`\n${unreachable.length} page(s) couldn't be fetched (network issue or the URL moved) —`);
    console.log(`  not evidence of a content problem by itself, but worth a manual look if it persists.`);
  }

  if (update) {
    const newBaseline = {
      lastUpdated: new Date().toISOString().slice(0, 10),
      pages: results.map(({ label, url, newHash }) => ({ label, url, hash: newHash ?? undefined })),
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2) + "\n", "utf-8");
    console.log(`\nBaseline updated (${newBaseline.lastUpdated}) — only do this after actually re-reading`);
    console.log(`the flagged pages and confirming the study content is still accurate.`);
  } else if (changed.length > 0 || unreachable.length > 0) {
    console.log(`\nOnce you've manually re-verified, run again with --update to reset the baseline.`);
  }

  process.exit(changed.length > 0 ? 1 : 0);
}

main();
