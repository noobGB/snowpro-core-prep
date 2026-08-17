# SnowPro Core Prep

A local, offline-first study app for the Snowflake **SnowPro Core (COF-C03)** certification —
turns a folder of your own markdown notes into a full study tool: domain notes, practice
questions, timed mock exams, flashcards, a day-by-day plan, and analytics. No account, no cloud
service, no telemetry — your content and your progress both stay on your machine.

![Dashboard](.github/screenshot-dashboard.png)

## Why this exists

Most exam-prep tools are either a paywalled question bank or a pile of markdown files with no way
to actually drill yourself. This is the middle path: write your study notes and practice questions
as plain markdown (however you already take notes), and a content pipeline turns them into a real
app — scored quizzes, a spaced-ish flashcard deck, readiness analytics weighted by actual exam
domain weights, and a study plan that shifts to fit whatever exam date you set.

It's built specifically around the SnowPro Core exam's structure (5 weighted domains, 100
questions, 115 minutes, pass line 750/1000), but the content pipeline doesn't know anything
Snowflake-specific — point it at a different set of markdown files following the same shape and it
works for a different exam.

## Features

- **Domain notes** — a proper reading view (table of contents, scrollspy, "quiz me on this
  section") generated from your markdown, not just links out to it.
- **Practice & mock exams** — one question per screen, arrow-key navigation, flag-for-review, and
  a jump palette, closer to how the real exam interface paces you than a long scrolling quiz page.
- **Flashcards** — flip-card drilling with a minimal knew-it/missed-it rating that biases which
  cards resurface first next session.
- **Study plan** — a day-by-day checklist that remaps itself against your actual exam date, not a
  fixed calendar.
- **Analytics** — a weighted readiness score, per-domain breakdown, and pacing feedback benchmarked
  against the real exam's time budget.
- **⌘K/Ctrl+K search** — one command palette across pages, notes, and questions.
- **Fully offline** — progress persists to a local file (via Docker) or `localStorage` (without
  it); nothing ever leaves your machine.

![Study plan](.github/screenshot-plan.png)

![Practice runner](.github/screenshot-runner.png)

## Quick start (Docker)

The app expects two things next to each other on disk: this repo, and a folder of your study
markdown.

```
your-workspace/
├── snowpro-core-prep/          # this repo
└── SnowPro_Core_Certification/ # your markdown notes — see "Content format" below
```

```bash
git clone <this-repo-url> snowpro-core-prep
cd snowpro-core-prep
docker compose build
docker compose up -d
```

Open **http://localhost:8080**. The container reads your markdown from `../SnowPro_Core_Certification`
(configurable — see `docker-compose.yml`), regenerates its content at every boot, and persists your
quiz progress to a local `./data/` folder. Edit your notes and `docker compose restart` to pick up
the changes; edit the app's own source and run `docker compose build` again.

```bash
docker compose logs      # boot order: "/data is writable" -> content summary -> "Serving on :8080"
docker compose down      # stop
```

If a markdown file has a genuine structural problem — a malformed question, a mock-exam question
that can't be matched to a domain — the container **refuses to start** and prints exactly what's
wrong and where, rather than serving a broken app silently.

## Content format

The pipeline discovers files by name pattern in your notes folder:

| Files | What they become |
|---|---|
| `01`–`05_*.md` | Domain notes (one per exam domain) |
| `10`–`14_*.md` | Domain-tagged practice questions |
| `16`+`_Mock_Exam_*.md` | Full mock exams (auto-detected, no config needed for a new one) |
| `00_Study_Plan.md` | The day-by-day plan |
| `07_Resources.md`, `08_Cheatsheet*.md`, `15_*Setup*.md` | Resources, flashcard source, setup guide |

Questions are plain markdown: a bold numbered stem, lettered options, and a separately-located
answer key — see any file under `10`–`14` in your own notes folder for the exact shape once you
have one, or the content pipeline's own tests (`pipeline/test/`) for minimal examples. Inline
`**bold**`, `*italic*`, and `` `code` `` in question text render properly throughout the app, not
just in notes.

## Local development (without Docker)

```bash
# Terminal 1 — generate content.json from your markdown
cd pipeline
npm install
npm run build:content -- --source ../../SnowPro_Core_Certification

# Terminal 2 — the frontend
cd app
npm install
npm run dev
```

The dev server falls back to `localStorage` for progress (no container, no `/api/progress` route)
— nothing else changes between the two setups.

```bash
cd pipeline && npm test              # 30 tests, vitest
cd app && npx tsc --noEmit           # typecheck
```

## Architecture

- **`pipeline/`** — a Node/TypeScript content pipeline. Parses the markdown folder into
  `content.json` (+ per-domain notes JSON + a search index), validates cross-references, and fails
  loudly with a grouped error report rather than serving partial/broken content.
- **`app/`** — a Vite + React 19 + TypeScript SPA. No backend framework — progress persistence is
  two small HTTP routes (`pipeline/src/server.ts`) backed by a mounted volume, with an automatic
  `localStorage` fallback when that backend isn't present.
- **`Dockerfile`** — a three-stage build (frontend, pipeline production deps, runtime) that runs
  the content pipeline at container boot, before the server binds — so a bad markdown file is
  caught at start-up, not on first page load.

See [`CLAUDE.md`](CLAUDE.md) for the full architecture writeup (parser internals, the progress
storage adapter, known gotchas) — written for AI coding agents working in this repo, but equally
useful for a human doing the same.

## Tech stack

TypeScript throughout · React 19 · Vite · `react-router-dom` · `unified`/`remark`/`remark-gfm` for
markdown parsing · Vitest · Express (two routes) · Docker.

## License

[MIT](LICENSE).
