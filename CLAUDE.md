# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For a human learning the stack itself (what each technology is, why it's here) rather than this
codebase's own structure, see [`TECH_STACK.md`](TECH_STACK.md) instead.

## What this repo is

A local, offline-first study app for the Snowflake SnowPro Core certification (COF-C03). The full
product/design spec — information architecture, visual design tokens, data model, screen-by-screen
wireframes, and a 15-step build order — lives in **`SnowPro Core Prep - Spec.dc.html`**; read it
before making any architectural or visual decision, since it's the source of truth this whole
project was built from. The other `*.dc.html` files (`Dashboard.dc.html`, `Notes.dc.html`, etc.)
are grey-box wireframes for each screen, and `Nav.dc.html` covers the sidebar/nav.

**All 15 steps of the spec's build order are complete**, including the Docker packaging in step 15
(storage adapter, `Dockerfile`, `docker-compose.yml`). A subsequent UI/UX review pass (an
engineering review plus a design critique, both driving the running app with Playwright) produced
17 follow-up fixes, also complete — see recent commit messages for the full list. There is no
pending build-order work; changes from here are maintenance, new features, or content updates.

## Running it

The normal path is Docker — one container serves the built frontend plus a small API, backed by
two host-mounted volumes:

```
docker compose build
docker compose up -d
docker compose logs      # boot order: "/data is writable" -> pipeline summary -> "Serving on :8080"
docker compose down
```

Open `http://localhost:8080`. `docker-compose.yml` mounts `./SnowPro_Notes_and_Questions` (the
markdown source, tracked in this repo) to `/content`, and a local `./data/` folder to `/data` for
progress persistence (gitignored — that one's genuinely personal, your quiz history). Editing
markdown + `docker compose restart` picks up content changes; editing `app/`/`pipeline/` source
needs `docker compose build` again, since the frontend bundle and pipeline are baked into the
image, not mounted.

For local dev without Docker, run the pipeline and the Vite dev server directly (see each
subsection's commands below) — `app/`'s dev server falls back to `localStorage` for progress when
no `/api/progress` route exists (i.e., outside the container), so both paths work without config.

## Content pipeline (`pipeline/`)

Reads the markdown study folder at `../SnowPro_Notes_and_Questions/` (tracked in this repo,
relative to `pipeline/`) and generates `content.json` + `notes/<domainId>.json` + `search-index.json` into
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
npm start                      # tsx src/server.ts — the container's actual entry point (§ below)
```

The pipeline **fails loudly and writes nothing** if any source file has a problem — a genuine parse
error, or a mock-exam question whose domain can't be resolved (see below). It collects every error
across every file in one run rather than stopping at the first one, so a failure report is always
one editing pass, not N pipeline runs. A clean run prints a count summary; a failing run prints
every error grouped by file.

### Architecture

`src/index.ts` exports the pipeline's orchestration as `runPipeline(config)`, with a thin CLI
wrapper (`main()`) around it; `src/server.ts` calls `runPipeline()` directly at container boot
(before binding the HTTP port), reusing the exact same logic and error report as the CLI. Everything
before `index.ts` is a leaf module; everything reads/writes through one shared `ErrorCollector`
(`src/errors.ts`) rather than throwing on content problems — only a genuine I/O failure (a file
that can't be read at all) throws directly.

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
  `unresolved-domain` error, not thrown — see `SnowPro_Notes_and_Questions/16_Mock_Exam_1.md` for the
  tagging convention already in use there.
- **`src/parsers/studyPlan.ts`** emits each plan day's *original* source date verbatim, not a
  pre-offset one — the frontend (`app/src/lib/planDates.ts`) remaps every day by the delta between
  the plan's own last day and the live exam date, and computes a plan-length-derived default (never
  a hardcoded calendar date) when no exam date is set yet.
- **`src/assemble/validate.ts`** runs structural cross-reference checks after everything else has
  parsed (every `questionIds` reference resolves, no duplicate ids, a mock set's `domainSplit` is
  independently recomputed from its questions and cross-checked against both the stored value and
  the split stated in the mock's own intro prose). These feed the same `ErrorCollector`, so a
  validation failure and a parse failure can show up in the same report.
- **`src/write/output.ts`** writes to a temp directory (a sibling of the output dir, same volume)
  and renames it into place, so a crash mid-write can't leave a half-updated `content/`. In the
  container, this means the runtime user needs write access to `/app`'s parent directory itself,
  not just `/app/content` — see the Dockerfile's `chown` comment if this ever regresses.
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

Vite + React 19 + TypeScript SPA (`react-router-dom` for routing, dark theme only — light mode is
stubbed in Settings but not built). Not an npm workspace with `pipeline/` — `src/lib/content.ts`'s
types are hand-duplicated from `pipeline/src/types.ts`; keep them in sync manually.

### Commands (run from `app/`)

```
npm install
npm run dev         # dev server — check its own log for the actual port; 5173 is often already
                     # taken by another local project on this machine, and Vite silently shifts
                     # to 5174+ without asking
npm run build        # production build
npx tsc --noEmit      # typecheck
```

### Architecture

`vite.config.ts` points `publicDir` at `../content` (the content pipeline's output), so
`content.json` / `notes/*.json` / `search-index.json` are served at the site root with no copy
step in dev — `src/lib/content.ts`'s `loadContent()` just `fetch("/content.json")`s it. In the
container, `pipeline/src/server.ts` serves both the pipeline's output and the built frontend from
the same origin instead. Re-run the pipeline and refresh the browser to pick up content changes;
nothing in `app/` parses markdown.

`src/components/AppShell.tsx` (sidebar + main content column on desktop; a top bar + fixed bottom
nav under 900px, via `.desktop-only`/`.mobile-only` in `tokens.css`) wraps every route defined in
`src/App.tsx`. `src/components/Sidebar.tsx` reads `content.json` itself (via the same cached
`useContent()` hook every page uses) to populate its meta-count badges — those are real counts, not
fixture data. `src/pages/NotFound.tsx` catches any unmatched route so a bad URL never renders blank.

**Progress/persistence** (`src/lib/progress.ts`) is a `useSyncExternalStore`-backed module store,
not React context. It tries `GET /api/progress` once on load; a 200 switches it to the container's
HTTP backend (`PUT /api/progress`, backed by the mounted `/data` volume), and any failure (dev
server, or the built files opened directly) falls back to `localStorage` — `getStorageBackend()`
exposes which one is active, shown in Settings so the two can't be silently mixed. Every write
replaces the whole `ProgressState` object (no partial merges). **Nested fields added after initial
release need `?? {}` at their read sites** — `loadFromStorage()`'s merge with `defaultState()` is
shallow, so old stored data has the parent key present but missing a newly-added child field, not
the parent key absent entirely (see `flashcards.grades` for the pattern, and its own doc comment
for why this bit a real bug once).

**Settings and the ⌘K palette** (`src/lib/settingsStore.ts`, `src/lib/paletteStore.ts`) are both
tiny external stores following the same pattern, mounted once at the App root (`src/App.tsx`) so
their global keyboard shortcuts work on every route including the session runner, which has no
sidebar. The two are mutually exclusive full-screen overlays — each closes the other on open; see
either store's doc comment before adding a third overlay of this kind.

**The question runner** (`src/pages/Runner.tsx`, shared by Practice and Mock) shows one question
per screen with Prev/Next, arrow-key navigation, flag-for-review (session-only, not persisted), and
a jump palette — not a long scroll. Scoring/timing/resume logic is untouched by that shape: a mock
attempt's elapsed time is always recomputed from a stored start timestamp (never a decrementing
counter, so closing the tab doesn't stop the clock), and a practice session left mid-way finalizes
as `"partial"` on unmount while a mock stays resumable. Question/option/explanation text renders
through `src/lib/inlineMarkdown.tsx`'s `renderInline()` (real React elements for `**bold**`/`` `code` ``/
`*italic*`, not `dangerouslySetInnerHTML`) — content authors write inline markdown in the source
`.md` files and every display site (Runner, Results, Practice's missed-review, Analytics) needs to
render it, not just Notes' pre-rendered HTML sections.

**A recurring gotcha, hit twice in this codebase**: calling a store's synchronous-subscriber-
notifying update function (e.g. `updateProgress()`) from *inside* another `setState`'s functional
updater trips "Cannot update a component while rendering a different component." Always call
side-effecting store updates as sibling statements in an event handler or effect, never nested
inside another component's `setState` updater callback.
