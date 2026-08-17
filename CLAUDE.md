# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A local, offline-first study app for the Snowflake SnowPro Core certification (COF-C03). The full
product/design spec — information architecture, visual design tokens, data model, screen-by-screen
wireframes, and a 15-step build order — lives in **`SnowPro Core Prep - Spec.dc.html`**; read it
before making any architectural or visual decision, since it's the source of truth this whole
project is built from. The other `*.dc.html` files (`Dashboard.dc.html`, `Notes.dc.html`, etc.) are
grey-box wireframes for each screen, and `Nav.dc.html` covers the sidebar/nav. `doc-page.js` and
`support.js` are the design tool's rendering runtime for those files, not app code — don't edit them.

**Steps 1-3 of the spec's 15-step build order** are implemented so far: the shell/sidebar (step 1)
and Dashboard (step 2) in `app/`, and the content pipeline (step 3) in `pipeline/`. The quiz
runner, results/analytics, and the Docker/volumes setup described in spec §9 have not been
started.

## Content pipeline (`pipeline/`)

Reads the markdown study folder at `../SnowPro_Core_Certification/` (a sibling directory, outside
this repo) and generates `content.json` + `notes/<domainId>.json` + `search-index.json` into
`content/`, per the data model in spec §4 and the discovery/parsing rules in spec §5. `content/` is
entirely generated output — never hand-edit it, and don't treat it as a source of truth for
anything; re-run the pipeline instead.

### Commands (run from `pipeline/`)

```
npm install
npm run build:content          # generate content/ from the default source dir
npm run build:content -- --source <dir> --output <dir>   # override paths (also via
                                # SNOWPRO_CONTENT_SOURCE / SNOWPRO_CONTENT_OUTPUT env vars)
npm run build:content:watch    # re-run on source changes
npm run typecheck              # tsc --noEmit
npm test                       # vitest run
npx vitest run test/questionCore.spec.ts   # run a single test file
```

The pipeline **fails loudly and writes nothing** if any source file has a problem — a genuine parse
error, or a mock-exam question whose domain can't be resolved (see below). It collects every error
across every file in one run rather than stopping at the first one, so a failure report is always
one editing pass, not N pipeline runs. A clean run prints a count summary; a failing run prints
every error grouped by file.

### Architecture

`src/index.ts` is the orchestrator. Everything before it is a leaf module; everything reads/writes
through one shared `ErrorCollector` (`src/errors.ts`) rather than throwing on content problems —
only a genuine I/O failure (a file that can't be read at all) throws directly.

- **`src/discovery.ts`** classifies source files by filename pattern (spec §5's table) — domain
  notes (`01`-`05`), practice questions (`10`-`14`), any mock exam (`1[6-9]|[2-9]\d_Mock_Exam_N.md`,
  matched automatically so a future `17_Mock_Exam_2.md` needs no code change), the cheatsheet,
  study plan, resources, and the setup log. Anything else is a logged skip notice, not an error.
- **`src/parsers/questionCore.ts`** is the shared line-based state machine both
  `practiceQuestions.ts` and `mockExam.ts` build on. It exists because a "question" (a bold `**N.**`
  stem, several `A.`-`D.` option lines, and a separately-located numbered answer-key entry) doesn't
  map cleanly onto markdown's block-level AST — everything else in `src/parsers/` uses
  `src/util/markdown.ts` (a `unified`/`remark`/`remark-gfm` wrapper) instead, walking real mdast
  nodes for headings/lists/tables/checkboxes.
- **`src/parsers/mockExam.ts`** resolves each mock question's domain two ways: stem-normalized
  dedup against the already-parsed domain-question pool (reusing that question's existing id —
  dedup always wins over an inline tag if a question somehow has both), or an inline `**N. [Dx]**`
  tag added directly to the mock's markdown. A question with neither is collected as an
  `unresolved-domain` error, not thrown — see `SnowPro_Core_Certification/16_Mock_Exam_1.md` for the
  tagging convention already in use there.
- **`src/assemble/validate.ts`** runs structural cross-reference checks after everything else has
  parsed (every `questionIds` reference resolves, no duplicate ids, a mock set's `domainSplit` is
  independently recomputed from its questions and cross-checked against both the stored value and
  the split stated in the mock's own intro prose). These feed the same `ErrorCollector`, so a
  validation failure and a parse failure can show up in the same report.
- **`src/write/output.ts`** writes to a temp directory and renames it into place, so a crash
  mid-write can't leave a half-updated `content/`.
- **`src/util/markdown.ts`'s `flattenText()`** collapses whitespace (including literal newlines
  mdast preserves for a markdown soft line-wrap) — always flatten mdast nodes to plain text through
  this helper, not a bare `mdast-util-to-string` call, or a regex anchored with `.`/`$` against the
  result will silently break on wrapped source lines.
- **`bankVersion`** in the output is a real `sha256:` hash over the sorted, concatenated source file
  bytes (`src/util/hash.ts`) — not a timestamp (a separate `generatedAt` field carries that) —
  because the app needs to detect whether an attempt ran against *unchanged* content, which a
  timestamp can't do.

`test/` fixtures are small synthetic markdown snippets, not the real content files, so tests stay
stable across unrelated content edits.

## Frontend app (`app/`)

Vite + React + TypeScript SPA (`react-router-dom` for routing). Not an npm workspace with
`pipeline/` yet — `src/lib/content.ts`'s types are hand-duplicated from `pipeline/src/types.ts`;
keep them in sync manually until that's worth consolidating.

### Commands (run from `app/`)

```
npm install
npm run dev         # dev server — check its own log for the actual port; 5173 is often already
                     # taken by another local project on this machine, and Vite silently shifts
                     # to 5174+ without asking
npm run build        # production build
npx tsc -b --noEmit   # typecheck
```

### Architecture

`vite.config.ts` points `publicDir` at `../content` (the content pipeline's output), so
`content.json` / `notes/*.json` / `search-index.json` are served at the site root with no copy
step — `src/lib/content.ts`'s `loadContent()` just `fetch("/content.json")`s it. Re-run the
pipeline and refresh the browser to pick up content changes; nothing in `app/` parses markdown.

`src/components/AppShell.tsx` (sidebar + main content column) wraps every route defined in
`src/App.tsx`. `src/components/Sidebar.tsx` reads `content.json` itself (via the same cached
`useContent()` hook every page uses) to populate its meta-count badges — those are real counts,
not fixture data. Routes without a built screen yet render `src/pages/Placeholder.tsx` so
navigation never dead-ends while the rest of the build order is in progress.

There is no progress/persistence layer yet (spec §4's Progress schema and two-route storage
adapter are build-order step 15) — anything that looks like user state today (the Dashboard's exam
date, today's-task checkboxes) is local `useState`, resets on reload, and should be treated as a
placeholder for the real thing, not extended in place. The Dashboard always renders the spec's
documented "no attempts yet" empty state honestly (real day-one plan tasks, not fabricated
readiness numbers) rather than faking progress data that doesn't exist.
