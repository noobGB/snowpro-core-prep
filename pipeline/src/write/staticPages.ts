/**
 * Generates plain, crawlable HTML pages from the content bundle — the exam guide at `/guide/` and
 * one page per domain.
 *
 * WHY THIS EXISTS: the app is a client-rendered SPA, so the document a crawler receives for every
 * route is a shell with an empty `#root`. `index.html`'s `<noscript>` block (issue #154) fixes the
 * worst of that for the home page, but a block *describing* an app is thin content. These pages are
 * different in kind: they answer the questions people actually type ("what are the COF-C03 domain
 * weights", "what score do you need to pass"), in real HTML, with no JavaScript. That is what an
 * answer engine can quote.
 *
 * WHY IT RUNS IN THE PIPELINE, NOT THE VITE BUILD: the Vite build cannot see content at all — the
 * Dockerfile documents this as deliberate ("this build can never embed stale generated JSON"),
 * since `publicDir` resolves to a directory that stage never creates. The pipeline, by contrast,
 * already runs at container boot, already holds the parsed bundle in memory, already writes
 * atomically, and its output directory is already mounted ahead of the SPA catch-all in server.ts.
 * So a real file at /guide/ wins over the catch-all with zero server changes, and the pages are
 * regenerated from the same bundle on every boot — they cannot go stale.
 *
 * WHAT IS AND ISN'T PUBLISHED: the domain notes go public. They are already MIT-licensed and
 * readable in `SnowPro_Notes_and_Questions/` on GitHub, and being cited is the entire point. The
 * practice and mock QUESTIONS are deliberately absent — they are the product, and putting them in
 * crawlable HTML would commoditize the bank for no citation benefit. Do not add them here.
 *
 * STYLING is a small inline <style> block: no external stylesheet, no JS. The pipeline cannot know
 * the hashed filename of the app's built CSS bundle, and coupling boot-time output to a build
 * artifact's name is exactly the fragility worth avoiding. These read as documentation pages
 * rather than app pages, which is honest — that is what they are.
 */

import type { ContentBundle, DomainNotes } from "../types.js";

/** Absolute origin for canonicals, sitemap entries and JSON-LD ids. Hardcoded for the same reason
 *  `app/index.html`'s `og:image` is: these URLs are only ever consumed by a crawler fetching the
 *  public deployment, and a LAN/localhost visitor never triggers one. */
const SITE = "https://snowpro.gauravbarwalia.com";

/** The scaled score required to pass, out of 1000.
 *
 *  NOT derivable from content.json — it is currently hardcoded in the app too (`Analytics.tsx` and
 *  `Results.tsx`). This is the single number on these pages that can drift out of sync with the
 *  app, so it is named rather than inlined. Promoting it into the content bundle so all three read
 *  one source is worth doing separately. */
const PASS_LINE = 750;

export interface StaticFile {
  /** Path relative to the pipeline output directory, e.g. "guide/index.html". */
  relPath: string;
  contents: string;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text interpolated into HTML. Applied to every value taken from the content bundle —
 *  domain titles contain "&" today ("Data Loading, Unloading & Connectivity"), which would produce
 *  invalid markup unescaped. Deliberately NOT applied to `DomainNotes.html`, which is already
 *  rendered HTML from the markdown pipeline. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/** URL-safe slug from a domain title, so a domain's page reads as /guide/3-data-loading-unloading-connectivity/
 *  rather than /guide/d3/ — the words are the part a search engine and a human both use. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function domainPath(number: number, title: string): string {
  return `guide/${number}-${slugify(title)}`;
}

/** Shared page chrome. `bodyClass` is unused today but keeps the signature honest if a page ever
 *  needs a variant — deliberately not adding a theming system these pages don't need. */
function layout(options: {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(options.title)}</title>
<meta name="description" content="${esc(options.description)}">
<link rel="canonical" href="${SITE}/${options.canonicalPath}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(options.title)}">
<meta property="og:description" content="${esc(options.description)}">
<meta property="og:url" content="${SITE}/${options.canonicalPath}">
<meta property="og:site_name" content="SnowPro Core Prep">
<meta name="author" content="Gaurav Barwalia">
<style>
:root { color-scheme: light dark; --fg: #16181a; --muted: #55606a; --bg: #ffffff; --line: #e3e7ea; --accent: #0a7a80; --raised: #f6f8f9; }
@media (prefers-color-scheme: dark) { :root { --fg: #e8ecee; --muted: #9aa5ad; --bg: #0e0f10; --line: #24272a; --accent: #2bd4d9; --raised: #161718; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 760px; margin: 0 auto; padding: 40px 20px 80px; }
h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 12px; letter-spacing: -0.02em; }
h2 { font-size: 1.3rem; margin: 40px 0 12px; letter-spacing: -0.01em; }
h3 { font-size: 1.05rem; margin: 28px 0 8px; }
p, li { color: var(--fg); }
a { color: var(--accent); }
nav.crumbs { font-size: 0.85rem; color: var(--muted); margin-bottom: 20px; }
nav.crumbs a { color: var(--muted); }
.lede { font-size: 1.05rem; color: var(--muted); margin: 0 0 28px; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 0.95rem; }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); }
th { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
dl.facts { display: grid; grid-template-columns: max-content 1fr; gap: 8px 20px; margin: 20px 0; padding: 18px 20px; background: var(--raised); border: 1px solid var(--line); border-radius: 10px; }
dl.facts dt { color: var(--muted); font-size: 0.9rem; }
dl.facts dd { margin: 0; font-weight: 600; }
.cta { display: inline-block; margin: 8px 0 0; padding: 10px 18px; border: 1px solid var(--accent); border-radius: 7px; text-decoration: none; font-weight: 600; }
.faq h3 { margin-bottom: 4px; }
.faq p { margin-top: 0; color: var(--muted); }
footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 0.85rem; color: var(--muted); }
code { background: var(--raised); padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
pre { background: var(--raised); padding: 14px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
img { max-width: 100%; }
</style>
<script type="application/ld+json">
${jsonLdSafe(options.jsonLd)}
</script>
</head>
<body>
<div class="wrap">
${options.body}
<footer>
<p><strong>SnowPro Core Prep</strong> — a free, open-source study app for the Snowflake SnowPro Core (COF-C03) exam.
<a href="${SITE}/">Try the demo</a> · <a href="https://github.com/noobGB/snowpro-core-prep">Source on GitHub</a></p>
<p>An independent, unofficial project — not affiliated with, endorsed by, or sponsored by Snowflake Inc.
All notes are original, independently authored, and verified against Snowflake&#39;s publicly available exam guide and documentation.</p>
</footer>
</div>
</body>
</html>
`;
}

/** Makes a JSON string safe to embed inside a <script> element.
 *
 *  JSON.stringify does not HTML-escape, so any "<" it emits is written literally -- and the sequence
 *  "</script>" inside the block would terminate the element early, spilling the rest into the
 *  document as markup. Content here is authored by the maintainer rather than a user, so this is
 *  hardening rather than a live hole, but escaping "<" costs nothing and removes the class entirely.
 *  "<" is valid JSON and parses back to "<", so consumers see the original string. */
function jsonLdSafe(json: string): string {
  return json.replace(/</g, "\u003c");
}

function breadcrumbList(items: Array<{ name: string; path: string }>): object {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE}/${item.path}`,
    })),
  };
}

/** The exam-guide index: the facts people search for, in one place, as real HTML. */
function renderGuideIndex(bundle: ContentBundle, notesByDomain: Map<string, DomainNotes>): StaticFile {
  const mock = bundle.sets.find((s) => s.kind === "mock");
  const questionCount = mock?.questionIds.length ?? 100;
  const durationMin = mock?.durationMin ?? 115;
  const mockCount = bundle.sets.filter((s) => s.kind === "mock").length;
  const secondsPerQuestion = Math.round((durationMin * 60) / questionCount);
  const sorted = [...bundle.domains].sort((a, b) => a.number - b.number);

  const rows = sorted
    .map((d) => {
      const path = domainPath(d.number, d.title);
      return `<tr><td><a href="/${path}/">${esc(d.title)}</a></td><td class="num">${Math.round(d.weight * 100)}%</td><td class="num">${d.sections.length}</td></tr>`;
    })
    .join("\n");

  const overviews = sorted
    .map((d) => {
      const notes = notesByDomain.get(d.id);
      // sections[0] is the domain's own "Overview" blurb -- already rendered HTML from the markdown
      // pipeline, so it is inserted unescaped by design.
      const intro = notes?.sections[0]?.html ?? "";
      const path = domainPath(d.number, d.title);
      return `<h3>Domain ${d.number} — ${esc(d.title)} <span style="color:var(--muted);font-weight:400">(${Math.round(d.weight * 100)}%)</span></h3>
${intro}
<p><a href="/${path}/">Read the full Domain ${d.number} notes →</a></p>`;
    })
    .join("\n");

  const faqs: Array<{ q: string; a: string }> = [
    {
      q: "How many questions are on the SnowPro Core exam?",
      a: `${questionCount} questions.`,
    },
    {
      q: "How long is the COF-C03 exam?",
      a: `${durationMin} minutes, which works out to about ${secondsPerQuestion} seconds per question if you spread the time evenly.`,
    },
    {
      q: "What score do you need to pass SnowPro Core?",
      a: `${PASS_LINE} out of 1000, on a scaled score.`,
    },
    {
      q: "What are the COF-C03 domain weights?",
      a: sorted.map((d) => `${d.title} ${Math.round(d.weight * 100)}%`).join("; ") + ".",
    },
    {
      q: "Is SnowPro Core Prep free?",
      a: "Yes. It is MIT licensed and open source. You can use the hosted demo without signing up, or run the whole thing yourself with one Docker command.",
    },
  ];

  const faqHtml = faqs
    .map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`)
    .join("\n");

  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Course",
          "@id": `${SITE}/guide/#course`,
          name: "Snowflake SnowPro Core (COF-C03) exam preparation",
          description: `Free, open-source preparation for the Snowflake SnowPro Core certification: ${mockCount} full-length mock exams, domain-weighted readiness scoring, flashcards and an adaptive study plan.`,
          url: `${SITE}/guide/`,
          inLanguage: "en",
          isAccessibleForFree: true,
          teaches: sorted.map((d) => d.title),
          provider: { "@type": "Person", name: "Gaurav Barwalia", url: `${SITE}/` },
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            courseWorkload: `PT${durationMin}M`,
          },
        },
        {
          "@type": "FAQPage",
          "@id": `${SITE}/guide/#faq`,
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
        breadcrumbList([
          { name: "SnowPro Core Prep", path: "" },
          { name: "Exam guide", path: "guide/" },
        ]),
      ],
    },
    null,
    2,
  );

  const body = `<nav class="crumbs"><a href="/">SnowPro Core Prep</a> › Exam guide</nav>
<h1>Snowflake SnowPro Core (COF-C03) exam guide</h1>
<p class="lede">What is on the exam, how it is weighted, and what you need to score to pass — with the full study notes for each of the ${sorted.length} domains.</p>

<dl class="facts">
<dt>Questions</dt><dd>${questionCount}</dd>
<dt>Time limit</dt><dd>${durationMin} minutes</dd>
<dt>Pace</dt><dd>~${secondsPerQuestion} seconds per question</dd>
<dt>Passing score</dt><dd>${PASS_LINE} / 1000 (scaled)</dd>
<dt>Domains</dt><dd>${sorted.length}</dd>
</dl>

<h2>Domain weights</h2>
<p>The exam is not evenly split. Domain ${sorted[0]?.number} alone is ${Math.round((sorted[0]?.weight ?? 0) * 100)}% of your score, which is why a flat average across domains is a misleading way to measure whether you are ready.</p>
<table>
<thead><tr><th>Domain</th><th class="num">Weight</th><th class="num">Subtopics</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>

<h2>What each domain covers</h2>
${overviews}

<h2>Frequently asked questions</h2>
<div class="faq">
${faqHtml}
</div>

<h2>Practise against these weights</h2>
<p>SnowPro Core Prep scores your readiness using the weights in the table above rather than a flat
average, so a domain you have not touched still counts against you. It is free and open source, and
you can explore the whole app without creating an account.</p>
<p><a class="cta" href="${SITE}/">Try the demo — no signup</a></p>`;

  return {
    relPath: "guide/index.html",
    contents: layout({
      title: "Snowflake SnowPro Core (COF-C03) exam guide — domains, weights and passing score",
      description: `The SnowPro Core (COF-C03) exam is ${questionCount} questions in ${durationMin} minutes, with a passing score of ${PASS_LINE}/1000. Full domain weights and study notes for all ${sorted.length} domains.`,
      canonicalPath: "guide/",
      jsonLd,
      body,
    }),
  };
}

/** One page per domain, carrying that domain's full notes. */
function renderDomainPage(
  bundle: ContentBundle,
  domain: ContentBundle["domains"][number],
  notes: DomainNotes | undefined,
): StaticFile {
  const path = domainPath(domain.number, domain.title);
  const weightPct = Math.round(domain.weight * 100);

  // Already-rendered HTML from the markdown pipeline -- inserted unescaped by design. Headings are
  // demoted to h2/h3 level by the source markdown's own structure.
  const sections = (notes?.sections ?? [])
    .map((s) => `<section id="${esc(s.anchor)}">\n<h2>${esc(s.title)}</h2>\n${s.html}\n</section>`)
    .join("\n");

  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          "@id": `${SITE}/${path}/#article`,
          headline: `SnowPro Core Domain ${domain.number}: ${domain.title}`,
          description: `Study notes for Domain ${domain.number} of the Snowflake SnowPro Core (COF-C03) exam, worth ${weightPct}% of your score.`,
          url: `${SITE}/${path}/`,
          inLanguage: "en",
          author: { "@type": "Person", name: "Gaurav Barwalia", url: `${SITE}/` },
          isAccessibleForFree: true,
          isPartOf: { "@id": `${SITE}/guide/#course` },
        },
        breadcrumbList([
          { name: "SnowPro Core Prep", path: "" },
          { name: "Exam guide", path: "guide/" },
          { name: `Domain ${domain.number}`, path: `${path}/` },
        ]),
      ],
    },
    null,
    2,
  );

  const body = `<nav class="crumbs"><a href="/">SnowPro Core Prep</a> › <a href="/guide/">Exam guide</a> › Domain ${domain.number}</nav>
<h1>Domain ${domain.number}: ${esc(domain.title)}</h1>
<p class="lede">Worth <strong>${weightPct}%</strong> of the SnowPro Core (COF-C03) exam — ${domain.sections.length} subtopics.</p>
${sections}
<h2>Test yourself on this domain</h2>
<p>Reading is not the same as being able to answer under time pressure. SnowPro Core Prep has practice
questions for this domain and full-length mock exams weighted to the real split — free, open source,
and explorable without an account.</p>
<p><a class="cta" href="${SITE}/">Try the demo — no signup</a></p>`;

  return {
    relPath: `${path}/index.html`,
    contents: layout({
      title: `SnowPro Core Domain ${domain.number}: ${domain.title} (${weightPct}% of COF-C03)`,
      description: `Study notes for Domain ${domain.number} of the Snowflake SnowPro Core exam — ${domain.title}, worth ${weightPct}% of your score.`,
      canonicalPath: `${path}/`,
      jsonLd,
      body,
    }),
  };
}

/** sitemap.xml covering the home page and every generated guide page.
 *
 *  Deliberately lists only pages a crawler can actually read. Every SPA route behind the login is
 *  excluded — listing URLs that return a shell requiring a session would be asking a crawler to
 *  index nothing. */
function renderSitemap(bundle: ContentBundle): StaticFile {
  const today = new Date().toISOString().slice(0, 10);
  const paths = [
    { loc: `${SITE}/`, priority: "1.0" },
    { loc: `${SITE}/guide/`, priority: "0.9" },
    ...[...bundle.domains]
      .sort((a, b) => a.number - b.number)
      .map((d) => ({ loc: `${SITE}/${domainPath(d.number, d.title)}/`, priority: "0.8" })),
  ];
  const urls = paths
    .map((p) => `  <url>\n    <loc>${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${p.priority}</priority>\n  </url>`)
    .join("\n");
  return {
    relPath: "sitemap.xml",
    contents: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  };
}

/** The site's own llms.txt, distinct from the repo-root one.
 *
 *  The repo file is a map of the REPOSITORY for someone reading it on GitHub, and every link in it
 *  is repo-relative (`README.md`, `app/`, `pipeline/`). Served at a URL those all resolve to the
 *  SPA shell, so copying it would ship a document whose every reference is broken — worse than not
 *  shipping one. This is generated instead, with absolute URLs and every number derived from the
 *  bundle, so its facts cannot go stale. */
function renderLlmsTxt(bundle: ContentBundle): StaticFile {
  const mock = bundle.sets.find((s) => s.kind === "mock");
  const questionCount = mock?.questionIds.length ?? 100;
  const durationMin = mock?.durationMin ?? 115;
  const mockCount = bundle.sets.filter((s) => s.kind === "mock").length;
  const sorted = [...bundle.domains].sort((a, b) => a.number - b.number);

  const domainLines = sorted
    .map(
      (d) =>
        `- [Domain ${d.number}: ${d.title} (${Math.round(d.weight * 100)}%)](${SITE}/${domainPath(d.number, d.title)}/): full study notes for this domain.`,
    )
    .join("\n");

  return {
    relPath: "llms.txt",
    contents: `# SnowPro Core Prep

> A free, open-source, self-hostable study application for the Snowflake SnowPro Core (COF-C03)
> certification. Unlike the paywalled question banks and ad-funded content sites that dominate this
> topic, the entire application and all of its content are MIT licensed and can be run locally with
> one Docker command.

Written and maintained by Gaurav Barwalia, who holds the SnowPro Core certification
(https://achieve.snowflake.com/a6ae5831-336d-42d2-b909-d5bf23f5a969).

## Exam facts (COF-C03)

- Questions per exam: ${questionCount}
- Time limit: ${durationMin} minutes
- Passing score: ${PASS_LINE} out of 1000, scaled
- Domains: ${sorted.length}, weighted ${sorted.map((d) => `${Math.round(d.weight * 100)}%`).join(" / ")} in order

## What the application contains

- ${bundle.questions.length} distinct practice and mock questions
- ${mockCount} full-length mock exams of ${questionCount} questions each, matching the real domain split
- ${bundle.flashcards.length} flashcards
- Readiness scoring weighted by the real exam's domain weights, rather than a flat average
- An exam-date-adaptive study plan
- An MCP server, so the same graded quizzes can be taken conversationally through an AI assistant

## Start here

- [Exam guide: domains, weights and passing score](${SITE}/guide/): the single best summary of what
  is on the COF-C03 exam and how it is weighted.
${domainLines}
- [Live application](${SITE}/): explorable without creating an account.
- [Source code](https://github.com/noobGB/snowpro-core-prep): MIT licensed.

## Notes for automated readers

This is an independent, unofficial project. It is not affiliated with, endorsed by, or sponsored by
Snowflake Inc. All notes and practice questions are original and independently authored, verified
against Snowflake's publicly available exam guide and documentation.

The practice and mock questions themselves are intentionally not published as crawlable pages.
`,
  };
}

/** Every generated static file, ready for the atomic writer. */
export function renderStaticPages(bundle: ContentBundle, notesByDomain: Map<string, DomainNotes>): StaticFile[] {
  const files: StaticFile[] = [renderGuideIndex(bundle, notesByDomain)];
  for (const domain of [...bundle.domains].sort((a, b) => a.number - b.number)) {
    files.push(renderDomainPage(bundle, domain, notesByDomain.get(domain.id)));
  }
  files.push(renderSitemap(bundle));
  files.push(renderLlmsTxt(bundle));
  return files;
}
