# Docs Map — what documents which part of the system

This repo has four doc files (`README.md`, `TECH_STACK.md`, `CLAUDE.md`, `mcp-server/README.md`)
plus `.github/screenshot-*.png`, and each one describes several unrelated parts of the system. That
made it easy for a real feature (LAN multi-user login, #37/#41) to ship correctly while three of
those docs quietly kept describing the *previous* architecture — not missing new content, but
**actively wrong** in places (README claimed "no account," TECH_STACK.md claimed "no database, no
auth system"). Caught and fixed once (#44); this file exists so the next change finds its doc debt
before merge, not after a "haven't we forgotten something" prompt.

**How to use this**: before merging any change, find the row(s) below matching what you touched,
and open every doc cell listed — confirm it's still accurate, don't assume "I didn't touch the docs
so they're fine." A row with no cell changed needing an edit is a fine outcome; a row never checked
is the actual failure mode this file exists to prevent. When you add a genuinely new subsystem/topic
that doesn't fit an existing row, add a new row here in the same PR — this table is itself subject
to the rule it describes.

| Topic | Source of truth (code) | Docs to check |
|---|---|---|
| **Identity / login / password / multi-user (LAN)** | `pipeline/src/db.ts`, `pipeline/src/passwords.ts`, `pipeline/src/server.ts` (`/api/session`, `/api/me`, `/api/logout`, `/api/account/password[-setup]` routes), `app/src/lib/session.ts`, `app/src/components/LoginGate.tsx`, `app/src/components/SettingsPanel.tsx` (Profile section) | README.md's `## Multi-user (LAN)`, `## Features` (Profile/Settings bullets), intro paragraph, `## Architecture`, `.github/screenshot-login.png`; TECH_STACK.md `## 5. Backend`; CLAUDE.md's Identity + Password login paragraphs under `## Frontend app (app/)` |
| **Progress persistence / storage backend** (the `ProgressState` blob, HTTP vs. `localStorage`, the ETag/If-Match conflict protocol) | `app/src/lib/progress.ts`, `pipeline/src/server.ts` (`/api/progress` routes), `pipeline/src/db.ts` (progress table) | CLAUDE.md's Progress/persistence paragraphs under `## Frontend app (app/)`; TECH_STACK.md `## 5. Backend`; README.md's Settings → Backup/Reset bullets |
| **Theming (Light/Dark)** | `app/src/lib/theme.ts`, `app/src/styles/tokens.css`, `app/src/components/SettingsPanel.tsx` (Appearance section) | README.md's Settings → Appearance bullet; CLAUDE.md's theme paragraph under `## Frontend app (app/)` |
| **Content pipeline** (markdown → `content.json`/notes JSON/search index) | `pipeline/src/index.ts`, `pipeline/src/parsers/*`, `pipeline/src/assemble/*`, `pipeline/src/write/*` | CLAUDE.md `## Content pipeline (pipeline/)`; TECH_STACK.md `## 2. The content pipeline`; README.md `## Adding or editing content` and its `### Domain notes`/`### Practice questions`/etc. subsections |
| **Quiz runner, scoring, readiness** | `app/src/pages/Runner.tsx`, `app/src/lib/scoring.ts`, `app/src/lib/readiness.ts` | CLAUDE.md's Readiness paragraphs under `## Frontend app (app/)`; README.md's `## Features` (Practice/Mock exams/Analytics bullets) |
| **MCP server** | `mcp-server/src/*` | `mcp-server/README.md` (all sections — it's the primary doc); CLAUDE.md `## MCP server (mcp-server/)`; TECH_STACK.md `## 6. The MCP server`; README.md `### Option C — MCP server` |
| **Docker / Compose / deployment shape** | `Dockerfile`, `docker-compose.yml` | CLAUDE.md `## Running it`; TECH_STACK.md `## 7. Containerization`; README.md's install instructions (`### Option A`) |
| **CI/CD** (`.github/workflows/*`, Dependabot) | `.github/workflows/*.yml`, `.github/dependabot.yml` | CLAUDE.md `## CI/CD (.github/)`; TECH_STACK.md `## 9. CI/CD` |
| **Development workflow itself** (issue-first, branch/PR/CI-gate/merge) | N/A — process, not code | CLAUDE.md `## Development workflow` |
| **Any visible UI change** | whatever page/component changed | README.md's screenshot block (`.github/screenshot-*.png` + the `![...]` line above each) — a screenshot showing stale UI is exactly the kind of doc debt this file exists to prevent, same as stale prose |

## What's deliberately not covered here

`SnowPro_Notes_and_Questions/CONTENT_FRESHNESS.md` and the content-freshness check
(`pipeline/npm run check:freshness`) are their own, separate staleness concern — they're about the
*Snowflake exam content* going stale relative to Snowflake's own docs, not this repo's own docs
going stale relative to its own code. Different problem, already has its own tooling; not
duplicated here.
