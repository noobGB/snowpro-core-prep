# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For a human learning the stack itself (what each technology is, why it's here) rather than this
codebase's own structure, see [`TECH_STACK.md`](TECH_STACK.md) instead. Before finishing any change
that touches identity/progress/theming/the content pipeline/the MCP server/Docker/CI, check
[`DOCS_MAP.md`](DOCS_MAP.md) for which docs (this file included) need a matching update — see the
"Development workflow" section below for exactly when this applies.

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
pending build-order work; changes from here are maintenance, new features, or content updates. The
`mcp-server/` package (below) is one such post-spec addition — it isn't in the original spec at all.

**Before treating any Snowflake fact in `SnowPro_Notes_and_Questions/` as ground truth in a
session happening well after the repo's last commit**, run `cd pipeline && npm run check:freshness`
— the content is a dated snapshot, not a live feed, and Snowflake's docs/exam guide do change. See
[`SnowPro_Notes_and_Questions/CONTENT_FRESHNESS.md`](SnowPro_Notes_and_Questions/CONTENT_FRESHNESS.md).

## Running it

The normal path is Docker — one container serves the built frontend plus a small API, backed by
two host-mounted volumes:

```
docker compose build
docker compose up -d
docker compose logs      # boot order: "/data is writable" -> pipeline summary -> "Serving on :8080"
docker compose down
```

Open `http://localhost:8080` — a "Who's studying?" gate screen (email + password, name on first
signup only) shows first; see "Identity & multi-user progress" below. Copy `.env.example` to
`.env` (gitignored) and fill in `SNOWPRO_SMTP_*` to enable forgot-password email (issue #59) —
Compose picks up a sibling `.env` automatically; without it, everything else works, "Forgot
password?" just responds with a clear "email isn't configured" error instead. `docker-compose.yml`
mounts
`./SnowPro_Notes_and_Questions` (the markdown source, tracked in this repo) to `/content`, and a
local `./data/` folder to `/data` for identity + progress persistence — `data/snowprep.sqlite`, one
row per person (gitignored — that one's genuinely personal, everyone's quiz history). Editing
markdown + `docker compose restart` picks up content changes; editing `app/`/`pipeline/` source
needs `docker compose build` again, since the frontend bundle and pipeline are baked into the
image, not mounted.

For local dev without Docker, run the pipeline and the Vite dev server directly (see each
subsection's commands below) — `app/`'s dev server falls back to `localStorage` for progress when
no `/api/progress` route exists (i.e., outside the container), so both paths work without config.

**Windows convenience launcher.** [`Launch-SnowPro.ps1`](Launch-SnowPro.ps1) wraps the two `docker
compose` commands above (start Docker Desktop if needed → `up -d` → wait for `localhost:8080` to
respond → open the browser) — optional, documented for end users in README.md's Option A, not part
of the app itself. It self-locates via its own file path (`$PSScriptRoot`, falling back to the
running process's path when compiled), so it only works kept in this same folder alongside
`docker-compose.yml`. Deliberately not committed as a compiled `.exe` — see the README section for
the one-line `ps2exe` build command instead, so nobody has to trust an unsigned binary from git
history.

## Development workflow

**Every feature/enhancement/bug fix — including self-directed ones with no external requester —
gets a GitHub issue before a branch.** The pattern, used consistently across this repo's history
(8 issues closed in one session on 2026-08-18, each its own branch/PR/CI-gate/merge) and re-affirmed
after one real lapse (the LAN multi-user feature, #37, was planned and built before #38 was filed for
it — corrected retroactively, not repeated): file the issue first (even a same-day, self-authored one
— the point is a paper trail that survives the session, not process for its own sake), branch off
`master` (`fix/issue-<N>-<slug>` or `feat/issue-<N>-<slug>`), build, self-review (in-session — see the
CI/CD section's note on why automatic per-PR Claude review was removed), push, open a PR with
`Closes #<N>` in the body, watch CI green (`gh pr checks --watch`), then merge. One issue/branch/PR
per unit of work, not batched — makes each change's CI run, review, and revert surface independently.

**Confirmed exception**: small edits and commits (a same-turn doc tweak, "remove this option," "fix
this typo") don't need their own issue — still branch + PR rather than a direct commit to `master`,
just skip the issue for these. Issue-first is for feature/enhancement/bug-fix work, not for small,
directly-instructed edits.

**Before merging, check [`DOCS_MAP.md`](DOCS_MAP.md)** for whether the change touches a topic that
table tracks — it maps each subsystem to exactly which doc files/sections describe it, so "did I
update the docs" is a lookup, not a memory exercise. Skipping this is exactly how README.md and
TECH_STACK.md ended up actively wrong (not just stale) after #37 shipped, caught and fixed a session
later in #44. If a change introduces a genuinely new topic not already a row in that table, add one
in the same PR.

For a plan-mode feature big enough to warrant its own design doc, the finalized plan also gets copied
to `C:\Users\gaura\Desktop\Claude\claude_plans\` (a workspace-wide convention, not specific to this
repo) — but that's a supplement to the GitHub issue, not a substitute for one; the issue is what's
actually visible in this repo's own history and Projects/Issues tab.

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
npm run check:freshness        # re-fetch the ~12 Snowflake doc pages this content was last
                                # verified against, flag any that changed since — see
                                # SnowPro_Notes_and_Questions/CONTENT_FRESHNESS.md
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
  matched automatically — five ship today, `16`-`20`; a future `21_Mock_Exam_6.md` needs no code
  change), the cheatsheet,
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
- **`src/parsers/setupLog.ts`** splits `15_Hands_On_Snowflake_Setup_Log.md` into two kinds — `##
  Setup Steps` (things to actually do, in order) and `## Known Issues & Fixes` (things that went
  wrong along the way) — so a step's instructions stay a clean checklist instead of mixed with
  troubleshooting narrative (reworked 2026-08-18 from a single flat list, per direct feedback that
  the old page read like a log dump). Each entry's only app-visible content is its own
  `> **Summary:**` blockquote and its commands; the full narrative stays in the file, reachable
  via a GitHub-slugified `sourceAnchor` deep link — don't add the full body back into `SetupItem`
  without a real reason, that's the exact thing this rework removed. Ids stay positional
  (`s-1`, `s-2`, ...), never parsed from the visible "Step N"/"Issue N" text, for the same reason
  as before: the log is append-only and a future addition could reintroduce numbering drift, but
  positional ids can't corrupt or collide either way.
- **`src/assemble/validate.ts`** runs structural cross-reference checks after everything else has
  parsed (every `questionIds` reference resolves, no duplicate ids, a mock set's `domainSplit` is
  independently recomputed from its questions and cross-checked against both the stored value and
  the split stated in the mock's own intro prose). These feed the same `ErrorCollector`, so a
  validation failure and a parse failure can show up in the same report.
  - **`parseMockMeta`'s `STATED_SPLIT_RE` is scoped to the intro section only** (text before the
    first standalone `---` line) — a real bug, fixed once discovered: the regex's `[^:]*` can span
    newlines, so searching the *whole file* let a stray `"...in Domain 3) fits this need?"` inside
    a question stem (no colon nearby) keep consuming text until it hit an unrelated colon+number
    combination much further down the file, silently overwriting the value correctly parsed from
    the intro. Mock 1 happened to never trip this; adding more mocks with the same reused stem did.
    If you ever touch this regex again, keep the intro-only scoping — don't widen it back to `raw`.
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

Vite + React 19 + TypeScript SPA (`react-router-dom` for routing). Theme is System/Light/Dark
(`settings.theme`, default `"dark"`) — `src/lib/theme.ts` resolves the preference to a `data-theme`
attribute on `document.documentElement` (set from an `App.tsx` root effect, not `AppShell`, since
`CommandPalette`/`SettingsPanel` are siblings of the routed tree and `Runner.tsx`'s session route
bypasses `AppShell` entirely — anything `AppShell`-scoped would miss them), and `tokens.css` carries
both palettes off that attribute plus a `prefers-color-scheme` media query for `"system"`. An inline
script in `index.html`, before any stylesheet, pre-applies `"light"` synchronously from localStorage
to avoid a flash — see its own comment for why this only fully covers the localStorage-backed case,
not the HTTP-backed deployment. Not an npm workspace with `pipeline/` — `src/lib/content.ts`'s
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

**Identity & multi-user progress.** Each person on the LAN identifies themselves by email + a
required password (issue #46 — the app was passwordless from issue #37 through #45; without a
password, anyone who knew another LAN user's email could log in as them and see their progress).
Email is still the sole identity/lookup key; password never participates in lookup, only
verification. **Name is only asked once, on a genuinely new email** (issue #41 — originally always
asked, corrected after live feedback that re-asking a returning user for a name the server already
had was bad UX): `POST /api/session` first tries email alone; a known email with a password already
set responds `{status:"needs_password"}` (client reveals a Password field), an unknown email
responds `{status:"new"}` (client reveals Name + a new-account Password field together, no account
created yet), and a known email with no password claimed yet (a legacy pre-#46 account) responds
`{status:"needs_password_setup"}` (see "Password login" below). `POST /api/session` never creates
or logs in on the first, information-gathering submit; only a resubmit with the right fields for
that state does. `name` stays display-only and freely editable in
place after the fact (SettingsPanel's Profile section, works with no password re-entry since a live
session already proves ownership) without creating a new account. `App.tsx` calls `GET /api/me`
once at boot; no session renders `components/LoginGate.tsx` (a "Who's studying?" card, same visual
tokens as `SettingsPanel`) instead of the routed app. `lib/session.ts` is the client for
`POST /api/session` / `GET /api/me` / `POST /api/logout` plus a tiny `useSessionUser()` store
(same `useSyncExternalStore` pattern as `settingsStore.ts`) so `Dashboard.tsx`'s greeting and
`SettingsPanel`'s Profile section can read the current user without prop-drilling through
react-router's `<Outlet>`. A known-email login shows a brief "Welcome back, {name}" before
completing — not just a nicety: on a shared, passwordless LAN device, browser autofill on the email
field could silently select a similar-but-wrong saved address, and this is the first real feedback
moment in the flow that would catch it. **Both login and sign-out do a full
`window.location.reload()`, not a React state transition** — deliberately, since that's what
re-runs `progress.ts`'s own module-load-time `hydrateFromServer()` boot probe against the freshly
set/cleared session cookie with zero changes needed to that file; see `lib/session.ts`'s own doc
comments for the full reasoning (this was independently verified while building the feature, not
just assumed from the plan that specified it).

**Password login (issue #46).** Hashed with `node:crypto`'s built-in `scrypt`
(`pipeline/src/passwords.ts` — self-describing `scrypt$N$r$p$salt$hash` format, `timingSafeEqual`
comparison), not argon2/bcrypt: this app's threat model is a trusted LAN with no internet exposure
by design, not an offline GPU-cracking attacker, so a new native/WASM dependency wasn't worth it.
`users.password_hash` is nullable and added via a `PRAGMA table_info`-guarded `ALTER TABLE` in
`db.ts`'s `openDb()` (idempotent on every boot, matching the rest of that function). **The
passwordless-to-password migration has no out-of-band identity proof** (no SMTP in this app) —
whoever claims a legacy account's password first gets it, which is the *same* trust level the app
already had (anyone who knew the email had full access), just closing the door going forward.
`db.ts`'s `setPasswordIfUnset()` makes the atomic `UPDATE ... WHERE password_hash IS NULL` itself
the race guard, not a preceding check. The **preferred** claim path is proactive, from an
already-live session (one that predates this feature, since cookies are 400-day) via
SettingsPanel's "Set a password" → `POST /api/account/password-setup` (no current password needed,
the session already proves ownership) — the login-gate `needs_password_setup` fallback above is
for a device with no live session. Setting or changing a password (`setPassword()`) deletes every
*other* session for that user, which matters more than usual here since sessions never expire on
their own. A lightweight in-memory `Map`-based lockout in `server.ts` (keyed by email, not IP — LAN
clients share a router) locks out repeated wrong-password guesses. Password requirements are NIST
800-63B-style (length only, `MIN_PASSWORD_LENGTH = 8`, no composition/rotation rules) — no
breach-list check, since that defends against an internet-facing threat this app doesn't have.

**Self-service password reset (issue #59).** LoginGate's "Forgot password?" link (only shown once
a known account's password field is revealed) → `POST /api/password-reset/request` → if the email
has an account, `db.ts`'s `createPasswordResetToken()` mints a random token (`password_resets`
table, 1-hour `expires_at`, any prior token for that user deleted first) and `mailer.ts` emails a
`/reset-password?token=...` link built from the request's own `req.protocol`/`req.get("host")` (no
fixed public-URL config, since the LAN address can vary). The response body is identical whether or
not the account exists — enumeration-safe — and is sent *before* the (fire-and-forget) email send
resolves, not after, so response latency itself can't leak account existence either. `mailer.ts`
wraps `nodemailer` against generic `SNOWPRO_SMTP_*` env vars (see `.env.example`; initial setup
targets Brevo's free relay, since it verifies a single sender address rather than a whole domain);
`isMailerConfigured()` gates a clear operator-facing 500 instead of a silent failure when SMTP was
never set up. `/reset-password` is reachable from a fully logged-out browser — `App.tsx` special-
cases that one path ahead of the normal loading/gate/ready auth-state machine, since the whole point
of the flow is having no session yet. `db.ts`'s `completePasswordReset()` is the one-time-use guard
(mirrors `setPasswordIfUnset()`'s "the UPDATE/DELETE itself is the guard" idiom) and, like an
authenticated password change, deletes every session for that account on success. **The operator
manually clearing `password_hash` back to `NULL` via direct DB access is still available** as a
fallback for an account with no email access at all, but is no longer the only recovery path.

**Admin CLI, not an admin UI** (`pipeline/scripts/admin-users.mjs`, `npm run admin:users --
list|remove <email>|reset-all`, run from `pipeline/`) — listing/removing accounts or wiping the
database entirely. No web-based admin route exists or is planned: that would need its own auth
story and expands attack surface for a capability only the operator (filesystem access to the host)
will ever use — same reasoning as the password-recovery path above. `remove`/`reset-all` default to
a dry run; `remove` needs `--yes`, `reset-all` needs both `--yes` and `--i-am-sure` (deliberately
harder to fat-finger, since there's no undo and the script takes no backup).

**Progress/persistence** (`src/lib/progress.ts`) is a `useSyncExternalStore`-backed module store,
not React context. It tries `GET /api/progress` once on load; a 200 switches it to the container's
HTTP backend (`PUT /api/progress`, now session-scoped — see above — backed by the mounted `/data`
volume's `snowprep.sqlite`), and any failure (dev server, files opened directly, or simply not
logged in yet) falls back to `localStorage` — `getStorageBackend()` exposes which one is active,
shown in Settings so the two can't be silently mixed. Every write replaces the whole
`ProgressState` object (no partial merges) — this shape is completely unchanged by the SQLite
migration; only *which* row gets read/written changed, never the JSON it contains. **Nested fields
added after initial release need `?? {}` at their read sites** — `loadFromStorage()`'s merge with
`defaultState()` is shallow, so old stored data has the parent key present but missing a
newly-added child field, not the parent key absent entirely (see `flashcards.grades` for the
pattern, and its own doc comment for why this bit a real bug once).

**A user's progress row has two independent writers**, not one: this HTTP route, and `mcp-server/`
writing the exact same bind-mounted `snowprep.sqlite` file directly (no HTTP involved, always
scoped to one fixed "owner" account — see the `mcp-server/` section below). `GET /api/progress`
returns an `ETag` (the row's `updated_at` revision, `pipeline/src/db.ts`); `PUT` must echo it back
via `If-Match`, and a mismatch — someone else wrote in between — gets a 409, which `progress.ts`
handles by re-hydrating from the server rather than retrying the stale write. This isn't defensive
boilerplate; a silent overwrite between the two writers happened once for real under the old
flat-file version, before this existed. If you add a third writer of this data, it needs to speak
the same ETag protocol, not bypass it. The 409 path is reactive end to end now, not silent:
`persist()` sets `conflictAt` and re-hydrates, `useProgressConflict()` (a second
`useSyncExternalStore` reader sharing the same `subscribe`/`listeners` pair `useProgress()` uses)
re-renders on that change, and `components/ConflictBanner.tsx` — mounted once in `AppShell.tsx`, so
it's visible on every route — turns it into a dismissible "a change didn't save" message instead of
only a `console.warn`.

**Migration from the pre-multi-user flat file.** `data/progress.json` (the single-user era's only
storage) is imported automatically, once: on the very first login after this feature ships (i.e.
the first time `users` is empty and someone completes `POST /api/session`), that person's account
gets the old file's exact contents as their starting progress row, and the old file is renamed to
`progress.json.migrated` so it's never re-imported. See `pipeline/src/db.ts`'s
`migrateFlatFileProgress()` — it fails open on a corrupt old file (skips the import, still renames
it aside) rather than blocking the very first login or destroying data with a bad parse.

**Readiness** (`src/lib/readiness.ts`) is a cumulative points model, not an extrapolation — each
domain owns a fixed slice of 1000 points (its exam weight), unmeasured domains contribute 0 rather
than being excluded and the remaining weights renormalized, so the headline number only rises as
more of the actual exam gets covered. A domain's own `scaled` field stays a domain-relative
accuracy rate (0-1000, independent of that domain's weight) precisely so `pickWeakestDomain()` —
also exported from here, shared with `mcp-server/`'s auto weak-domain pick — recommends by
knowledge gap, not by which domain happens to be worth the most exam points. `Dashboard.tsx`'s
"Keep going" card calls this rather than hardcoding a domain; if it ever goes back to pointing at a
fixed domain, that's a regression, not a simplification. It also renders a one-line reason chip
("Not started yet" vs. "Lowest score so far", from that domain's own `scaled === null` check) next
to the recommendation — a bare recommendation with no visible rationale reads as untrustworthy the
first time a user checks the math themselves, so don't drop the reason without replacing it with an
equivalent one. **`Dashboard.tsx`'s domain rows and `Analytics.tsx`'s domain rows intentionally show
different numbers for the same domain** (e.g. "103 pts / 310" vs. "333 / 1000") — one is
weight-scaled earned points, the other is domain-relative accuracy — and both are labeled
accordingly (`pts` suffix; `/ 1000` suffix + the kicker reads "accuracy" not "readiness") precisely
because an earlier version showed both as bare unlabeled numbers and a design review confirmed that
reads as flatly inconsistent, not just under-explained. The weight badge next to each domain title
is a real `<button>` (not a plain `<span title="...">`) for the same reason — a hover-only tooltip
is invisible to keyboard and touch input, which failed WCAG 1.4.13/2.1.1 outright on the sub-900px
layout this repo treats as first-class; it has an `aria-label` for screen readers plus a
click/Enter-toggled visible tooltip (state lives in `Dashboard.tsx`, not the badge itself) for
sighted keyboard/touch users. Don't revert either of these to a plain hover-only `title` attribute.

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

## MCP server (`mcp-server/`)

A standalone MCP server exposing quiz sessions and progress tracking as tools, so an MCP host
(Claude Desktop, Claude Code, a voice agent) can quiz someone conversationally instead of driving
the web UI. Not part of the Docker image or the spec's original 15-step build order — a later
addition, run separately (`npm start` in `mcp-server/`, or registered with a host per its own
README). Full tool list, environment variables, and a manual test recipe live in
[`mcp-server/README.md`](mcp-server/README.md) — this section is only the "how it fits with the
rest of the repo" summary.

- **Same state, two front doors — but always ONE fixed account, not whoever's logged into the web
  app.** It reads/writes `data/snowprep.sqlite` directly — the identical file `pipeline/src/db.ts`
  / `pipeline/src/server.ts` serve over HTTP to the container — via a Docker bind mount, not a
  named volume, so both processes see the literal same file on disk with no sync step. Unlike the
  web app (which now supports multiple people, each with their own isolated progress),
  `mcp-server/` has no multi-user concept at all: it always operates on one fixed "owner" row,
  chosen by `SNOWPRO_OWNER_EMAIL` if set, else whichever account was created first (see
  `mcp-server/README.md`'s environment-variables section). See the ETag/`If-Match`-equivalent
  protocol above (Frontend app → Progress/persistence) for how the two writers avoid clobbering
  each other's writes to that one row.
- **Deliberately not WAL mode.** `pipeline/src/db.ts`'s `openDb()` opens `snowprep.sqlite` with
  SQLite's default rollback journal, not `journal_mode = WAL` (otherwise the obvious default for a
  small embedded-DB Node app) — WAL needs shared-memory (`mmap`) coordination between every
  process with the file open, which SQLite's own docs say breaks down over a network filesystem.
  This app's actual deployment is exactly that shape in disguise: the container opens this file
  through Docker Desktop's bind-mount translation layer while `mcp-server/`'s stdio process opens
  the identical file directly from the Windows host's NTFS — two different filesystem layers on
  what SQLite needs to treat as one local disk. See `openDb()`'s own doc comment before ever
  turning WAL back on for this database.
- **Never reimplements scoring or readiness.** `mcp-server/src/session.ts` imports
  `app/src/lib/scoring.ts` (`questionCredit`/`scaledScore`/`byDomainBreakdown`) and
  `app/src/lib/readiness.ts` (`overallReadiness`, `pickWeakestDomain`) directly, so a quiz taken
  through this server is scored identically to one taken in the web app, and its weak-domain
  auto-pick is the same function the Dashboard's "Keep going" card calls.
- **Not an npm workspace member either** — like `pipeline/`/`app/`, it imports the other two
  packages' `.ts` source via relative path rather than a shared package boundary; see its own
  README's "Design notes" for why (the `moduleResolution` compatibility shim needed to typecheck
  against both packages' different import-suffix conventions in one program, and why it hand-copies
  `defaultProgressState()` a third time instead of importing `app/src/lib/progress.ts`, whose
  module top level calls browser-only `localStorage` unconditionally).
- **`tsconfig.json` needs an explicit `"types": ["node"]`** — confirmed the hard way when bumping
  to `typescript@7`: that version stopped reliably auto-including ambient `@types/*` packages
  specifically for a program that spans files *outside* its own tsconfig directory (this
  `tsconfig.json`'s `include` only lists `mcp-server/`'s own files, but `session.ts` etc. pull in
  `../pipeline/src/*.ts` and `../app/src/lib/*.ts` by relative import, which is exactly that
  situation). Symptom: `tsc --noEmit` failing with `TS2591: Cannot find name 'process'`/`'node:*'`
  across both `mcp-server/`'s own files and the imported `pipeline/`/`app/` files, despite
  `@types/node` genuinely being installed. `pipeline/` and `app/` don't need this (their tsconfigs
  only include files inside their own directory), so don't copy this fix there without confirming
  they actually need it too.
- **Content, read without the container.** It runs `runPipeline()` itself (same function
  `pipeline/src/server.ts` calls at boot) rather than depending on `content.json` already existing
  — so it works with the Docker container stopped, reading straight from
  `SnowPro_Notes_and_Questions/`.

## CI/CD (`.github/`)

Three GitHub Actions workflows, all repo-wide (not scoped to one package):

- **`workflows/ci.yml`** — four jobs on every push to `master` and every PR: `pipeline`
  (typecheck + vitest), `app` (typecheck + oxlint — no test script exists yet, see the app/
  section above), `mcp-server` (typecheck + vitest), and `docker-smoke` (`docker compose build`,
  boot the container, curl `localhost:8080` for a real 200, always tear down). Each npm job runs
  `npm ci` in its own package directory — these three packages aren't an npm workspace, so there's
  no single root install step. `docker-smoke` pre-creates `./data` with open permissions before
  building — a fresh checkout has no `./data` (gitignored), and since the final image stage runs as
  the non-root `node` user while `docker-compose.yml` bind-mounts `./data` at runtime (overlaying
  the image's own build-time `chown`), an implicitly-auto-created host directory would come up
  root-owned and fail `server.ts`'s `verifyDataDirWritable()` boot check — a CI-only false negative,
  not a real bug, if that step is ever removed.
- **`workflows/claude.yml`** — the Claude Code GitHub Action (`anthropics/claude-code-action@v1`),
  responding to an `@claude` mention in a PR/issue comment or review — on demand only, never
  automatically. Its `claude_args`' `--system-prompt` tells it to follow this file's conventions
  and keep doc-sync commits separate from code commits, the practice already established in this
  repo's own history. Needs the `ANTHROPIC_API_KEY` repo secret (Settings → Secrets and variables
  → Actions) and the Claude GitHub App installed (`https://github.com/apps/claude`) — neither is
  provisionable by a file change alone. If you ever touch this workflow, re-verify
  `anthropics/claude-code-action`'s current `examples/claude.yml` before trusting this file's
  existing YAML — its inputs have changed across versions before.
  **There used to also be a `workflows/claude-review.yml`** that ran this same action
  automatically on every PR open/sync — removed 2026-08-18 on cost grounds: real spend (~$4 across
  a handful of PRs, some genuinely substantive diffs, not even the Dependabot case already ruled
  out below) made "on every PR, whether wanted or not" not worth it for a low-traffic personal
  repo, even though the automatic reviews it ran were real and substantive — one caught a genuine
  bug (positional setup-log ids breaking under reordering) this session. If you want that
  capability back, an `@claude review this PR` comment gets the identical review on demand,
  without paying for one on every routine PR automatically — same reasoning as the Dependabot
  decision below, just extended to human-authored PRs too once real cost data came in. **Before
  re-adding automatic per-PR review, re-derive whether the cost is worth it from current pricing
  and actual PR volume — don't just restore the old workflow file from git history unexamined.**
  The Dependabot-specific question this raised at the time (should the automatic version review
  bot-authored PRs at all) is now moot along with the rest of `claude-review.yml`, but the
  underlying lesson generalizes and is still live for `claude.yml`: `git show
  eafc895..HEAD -- .github/workflows/claude-review.yml`'s history has the full "allowlist added,
  then reverted, then the whole workflow removed" arc if useful context for a similar decision on
  any future automatic-trigger workflow in this repo.
- **`dependabot.yml`** — weekly (Monday) dependency PRs for each of the three npm packages plus
  the workflow files themselves, with minor/patch bumps grouped per package to keep PR volume down
  on a low-traffic repo.

Branch protection is intentionally not configured — this is a private repo, and GitHub's branch
protection rulesets require a paid plan or a public repo (confirmed via a 403 from the API); CI
still reports pass/fail status on every PR/commit via the Checks tab, it just doesn't technically
block merging.
