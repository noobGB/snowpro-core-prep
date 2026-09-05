/**
 * Tests the generated crawlable pages (/guide/, per-domain, sitemap.xml, llms.txt).
 *
 * The assertion that matters most is the negative one: no question STEM may appear in any generated
 * page. The notes and the questions necessarily share vocabulary — a note about the Search
 * Optimization Service and an answer option naming it are the same words by nature — so matching on
 * options or explanations produces false positives and tells you nothing. A question's identity is
 * its stem, and publishing stems is what would commoditize the bank.
 */

import { describe, expect, it } from "vitest";
import { renderStaticPages } from "../src/write/staticPages.js";
import type { ContentBundle, DomainNotes } from "../src/types.js";

function bundle(overrides: Partial<ContentBundle> = {}): ContentBundle {
  return {
    bankVersion: "sha256:test",
    generatedAt: "2026-01-01T00:00:00.000Z",
    generatedFrom: [],
    domains: [
      { id: "d1", number: 1, title: "Architecture & Features", weight: 0.31, noteFile: "d1.md", sections: [{ id: "1.1", title: "Overview", anchor: "overview" }] },
      { id: "d2", number: 2, title: "Data Collaboration", weight: 0.1, noteFile: "d2.md", sections: [] },
    ],
    questions: [
      {
        id: "d1-q1",
        domainId: "d1",
        type: "single",
        stem: "Which Snowflake layer stores micro-partitions for a permanent table?",
        options: [{ key: "A", text: "Storage" }, { key: "B", text: "Compute" }],
        correct: ["A"],
        explanation: "Storage holds micro-partitions.",
        sourceFile: "d1.md",
        sourceIndex: 1,
      },
    ],
    sets: [
      { id: "mock-1", kind: "mock", title: "Mock 1", questionIds: new Array(100).fill("d1-q1"), timed: true, durationMin: 115, domainSplit: { d1: 31, d2: 10 } },
    ],
    flashcards: [],
    plan: [],
    resources: [],
    setup: [],
    ...overrides,
  };
}

function notes(): Map<string, DomainNotes> {
  return new Map([
    ["d1", { domainId: "d1", sections: [{ id: "1.1", title: "Overview", anchor: "overview", html: "<p>Storage and compute are separate.</p>" }] }],
  ]);
}

function fileByPath(files: ReturnType<typeof renderStaticPages>, relPath: string): string {
  const found = files.find((f) => f.relPath === relPath);
  expect(found, `expected a generated file at ${relPath}`).toBeDefined();
  return found!.contents;
}

describe("renderStaticPages", () => {
  it("generates a guide index, one page per domain, a sitemap and llms.txt", () => {
    const files = renderStaticPages(bundle(), notes());
    const paths = files.map((f) => f.relPath).sort();
    expect(paths).toEqual([
      "guide/1-architecture-and-features/index.html",
      "guide/2-data-collaboration/index.html",
      "guide/index.html",
      "llms.txt",
      "sitemap.xml",
    ]);
  });

  it("derives the exam facts from the bundle rather than hardcoding them", () => {
    // Pace is durationMin*60/questionCount -- 115*60/100 = 69s. Changing the mock's shape must move
    // these numbers, which is the whole reason the pages are generated instead of hand-written.
    const html = fileByPath(renderStaticPages(bundle(), notes()), "guide/index.html");
    expect(html).toContain("115 minutes");
    expect(html).toContain("69 seconds");
    expect(html).toContain("750");
    expect(html).toContain("31%");
    expect(html).toContain("10%");
  });

  it("NEVER publishes a question stem", () => {
    // The safety property. Notes and questions share subject vocabulary by nature, so this checks
    // stems specifically -- a question's identity -- not incidental word overlap.
    const b = bundle();
    const everything = renderStaticPages(b, notes())
      .map((f) => f.contents)
      .join("\n");
    for (const q of b.questions) {
      expect(everything).not.toContain(q.stem);
    }
  });

  it("escapes HTML in domain titles", () => {
    // "Architecture & Features" would produce invalid markup unescaped, and real domain titles
    // contain "&" today.
    const html = fileByPath(renderStaticPages(bundle(), notes()), "guide/index.html");
    expect(html).toContain("Architecture &amp; Features");
    // Checked against the markup only. JSON-LD is JSON, not HTML, so "&" is correctly literal
    // inside the <script> block -- asserting over the whole document would fail for the wrong
    // reason and teach the next reader something untrue.
    const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(markup).not.toContain("Architecture & Features");
  });

  it("escapes < inside the JSON-LD so it cannot break out of the script element", () => {
    // JSON.stringify does not HTML-escape, so a literal "</script>" in any embedded string would
    // terminate the block early and spill the rest into the document as markup. Authored content,
    // so hardening rather than a live hole -- but the escape is free.
    const files = renderStaticPages(bundle(), notes());
    for (const f of files.filter((x) => x.relPath.endsWith(".html"))) {
      const block = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(f.contents)![1]!;
      expect(block).not.toContain("<");
      expect(() => JSON.parse(block)).not.toThrow();
    }
  });

  it("embeds pre-rendered note HTML without escaping it", () => {
    const html = fileByPath(renderStaticPages(bundle(), notes()), "guide/1-architecture-and-features/index.html");
    expect(html).toContain("<p>Storage and compute are separate.</p>");
  });

  it("gives every page a self-referencing canonical", () => {
    const files = renderStaticPages(bundle(), notes());
    for (const f of files.filter((x) => x.relPath.endsWith(".html"))) {
      const dir = f.relPath.replace(/index\.html$/, "");
      expect(f.contents).toContain(`<link rel="canonical" href="https://snowpro.gauravbarwalia.com/${dir}">`);
    }
  });

  it("emits valid JSON-LD on every page, with Course and FAQPage on the guide index", () => {
    const files = renderStaticPages(bundle(), notes());
    for (const f of files.filter((x) => x.relPath.endsWith(".html"))) {
      const match = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(f.contents);
      expect(match, `no JSON-LD in ${f.relPath}`).not.toBeNull();
      expect(() => JSON.parse(match![1]!)).not.toThrow();
    }
    const index = JSON.parse(
      /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(fileByPath(files, "guide/index.html"))![1]!,
    ) as { "@graph": Array<{ "@type": string }> };
    expect(index["@graph"].map((n) => n["@type"])).toEqual(["Course", "FAQPage", "BreadcrumbList"]);
  });

  it("lists every generated HTML page in the sitemap, plus the home page", () => {
    const files = renderStaticPages(bundle(), notes());
    const sitemap = fileByPath(files, "sitemap.xml");
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toContain("https://snowpro.gauravbarwalia.com/");
    for (const f of files.filter((x) => x.relPath.endsWith("index.html"))) {
      const dir = f.relPath.replace(/index\.html$/, "");
      expect(locs).toContain(`https://snowpro.gauravbarwalia.com/${dir}`);
    }
  });

  it("uses only absolute links in llms.txt", () => {
    // The repo-root llms.txt is repo-relative (README.md, app/, pipeline/) and would resolve to the
    // SPA shell if served -- shipping a document whose every link is broken is worse than shipping
    // none. This is the generated, site-facing one, so every link must be absolute.
    const txt = fileByPath(renderStaticPages(bundle(), notes()), "llms.txt");
    const links = [...txt.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toMatch(/^https?:\/\//);
    }
  });

  it("survives a domain with no notes", () => {
    // d2 has no entry in the notes map. A missing note file must not throw on the boot path.
    expect(() => renderStaticPages(bundle(), notes())).not.toThrow();
    const html = fileByPath(renderStaticPages(bundle(), notes()), "guide/2-data-collaboration/index.html");
    expect(html).toContain("Data Collaboration");
  });

  // Issue #177. The repository is open source; this site is a product built on it and does not
  // present itself as having a public upstream. That is a positioning decision, not a licensing
  // one -- MIT's notice obligation is triggered by distributing copies, and hosting is not
  // distribution, so nothing is owed here.
  //
  // This is a test rather than a comment because the leak was never in one obvious place: the
  // strings were spread across a footer, a FAQ answer, a Course description, a CTA on every domain
  // page, and llms.txt, several of them split across lines inside template literals so a source
  // grep missed them. Only scanning the rendered output caught them all. An assertion runs on every
  // change; a convention does not.
  it("never presents the site as open source", () => {
    const forbidden = [
      /open[\s-]?source/i,
      /self[\s-]?host/i,
      /\bMIT\b/,
      /github\.com/i,
      /\bdocker\b/i,
      /opensource\.org/i,
    ];

    const files = renderStaticPages(bundle(), notes());
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      for (const pattern of forbidden) {
        expect(
          file.contents,
          `${file.relPath} presents the site as open source (matched ${pattern})`,
        ).not.toMatch(pattern);
      }
    }
  });
});
