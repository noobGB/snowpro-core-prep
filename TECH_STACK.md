# Tech Stack — What Each Piece Does, and Why

This file is for humans learning the stack, not for an AI coding agent working in the repo (that's
[`CLAUDE.md`](CLAUDE.md) — architecture, file layout, known gotchas, assumes you already know what
React/Vite/Docker *are*). This file assumes the opposite: you know how to code, but maybe not this
particular set of tools, and want to know what each one is *for* and where to actually see it doing
its job in this codebase — not a generic tutorial, a map from "the library" to "the real line of
code using it."

Organized in the order a request actually flows through the system: markdown on disk → structured
data → a running app in your browser → the container that ships it.

## 1. Language & tooling

**TypeScript** — JavaScript with a type system bolted on: you describe the *shape* of your data
(`interface Question { stem: string; options: QuestionOption[]; ... }`) and the compiler catches
mismatches before the code ever runs, instead of finding out at runtime that you tried to call
`.map()` on `undefined`. Used in both halves of this repo — `pipeline/` and `app/` — but they're
**not** an npm workspace, so the same shapes are hand-duplicated between `pipeline/src/types.ts`
and `app/src/lib/content.ts` (documented in that file's own comment) rather than shared. That's a
real, deliberate tradeoff: simpler setup now, a maintenance cost (keep two files in sync by hand)
accepted until it's worth fixing.

**Node.js** — the JavaScript runtime that runs *outside* a browser. The content pipeline is a
plain Node script (reads files, writes files, no browser involved at all); the tiny server in the
Docker container is Node too. The frontend app, once built, runs in the browser and has nothing to
do with Node at that point — Node's job ends at "build/serve," not "run."

## 2. The content pipeline — markdown in, structured JSON out

This is the most unusual part of the stack, and worth understanding as a pipeline, not a grab-bag
of libraries. The job: read `.md` files, end up with `content.json` + one `notes/<domain>.json`
per domain + `search-index.json`.

- **`unified`** — not a library that does any one thing itself; it's a plugin-pipeline runner.
  You hand it a chain of plugins ("parse this format," "transform the tree," "output this other
  format") and it runs them in order, passing a shared tree structure between them. Everything
  below is a `unified` plugin.
- **`remark-parse`** — turns raw markdown text into an **AST** (abstract syntax tree, called
  "mdast" here — *m*arkdown *a*bstract *s*yntax *t*ree): a real tree of heading/paragraph/list/
  table nodes, not a string. This is what lets the pipeline ask "what are this domain's H2
  sections" as a structural query instead of a fragile regex over text.
- **`remark-gfm`** — adds GitHub-Flavored Markdown to the parser: tables, checkboxes (`- [ ]`,
  `- [x]`), strikethrough. Without this plugin, the study plan's checklists and the resources
  tables wouldn't parse as tables/checkboxes at all, just plain paragraph text.
- **`remark-rehype`** — converts the markdown AST (mdast) into an **HTML** AST (called "hast").
  Different tree shape, same idea — now the nodes are `<h2>`/`<p>`/`<li>`, ready to become real
  markup.
- **`rehype-stringify`** — the last step: turns the HTML AST into an actual HTML string. This is
  the byte-faithful HTML that ends up in `notes/<domain>.json`'s `section.html`, which the Notes
  page renders directly (`dangerouslySetInnerHTML` — safe here specifically because the HTML was
  generated from trusted, author-controlled markdown, not arbitrary user input).
- **`mdast-util-to-string`** — flattens an mdast node back down to plain text (strips all the
  `**bold**`/`*italic*` formatting, just the words). Used where a *section title* or similar needs
  to be plain text rather than rendered HTML. Has a real, documented gotcha: a markdown file that
  hard-wraps a sentence across multiple lines (very common in hand-written `.md`) produces a
  literal `\n` character in the flattened string at the wrap point, not a space — which silently
  breaks any regex using `.`/`$` against the result, since `.` doesn't match newlines by default.
  Fixed once, centrally, in `pipeline/src/util/markdown.ts`'s `flattenText()` helper
  (`.replace(/\s+/g, " ").trim()`) — a good example of "one bug, fixed in one shared place" instead
  of patched at each call site.
- **`unist-util-visit`** — a tree-walking helper (`unist` = the even-more-generic tree format both
  mdast and hast are built on). "Walk this tree and call my function on every node of type X" —
  used wherever the pipeline needs to pull something specific out of a parsed document (e.g. every
  link inside a study-plan task, to figure out which page it should point to).

**Not `unified`-based: the practice-question parser.** `pipeline/src/parsers/questionCore.ts` is a
hand-written, line-by-line state machine instead. Reason: a "question" in this content format is a
bold numbered stem, several lettered option lines, and a *separately located* numbered answer-key
entry, matched by number rather than position — that shape doesn't correspond to anything markdown's
block-level structure understands (`unified` sees headings/lists/paragraphs, not "question 7's
answer, which happens to be forty lines further down the file"). Right tool for two different
jobs, in the same file tree.

## 3. Testing

**Vitest** — the test runner for the pipeline (`pipeline/test/`, 30 tests). Chosen as the natural
fit for a Vite-adjacent, ESM-native TypeScript project — fast, no separate transpile step needed.
The tests deliberately run against small, hand-written markdown *fixtures*, not the real content
files in `SnowPro_Notes_and_Questions/` — so editing your actual study notes can never accidentally
break the test suite, and the test suite can never accidentally depend on content that might change.

## 4. Frontend — React 19, Vite, React Router

**React** — the UI library: you describe what the screen should look like *for a given piece of
state* (`{on ? "✓" : ""}`), and React figures out the minimal DOM changes needed when that state
changes, instead of you hand-writing `element.classList.add(...)` calls all over the place. This
app is plain React with no state-management library (no Redux/Zustand) — state either lives in a
component (`useState`), or in one of a few small hand-rolled external stores
(`app/src/lib/progress.ts`, `paletteStore.ts`, `settingsStore.ts`) built on React's own
`useSyncExternalStore` hook, which exists specifically for "state that lives outside React but
components need to subscribe to." (**`react-dom`** is the separate package doing the actual work —
"React" itself is platform-agnostic in principle, React DOM is specifically the part that knows how
to render into a browser's real DOM; you always need both together for a web app, which is why
they're always installed as a pair.)

**Vite** — the dev server and production bundler. Two distinct jobs: in development
(`npm run dev`), it serves your source files basically as-is and recompiles instantly on save (no
"webpack watching your whole project" wait); in production (`npm run build`), it bundles and
minifies everything into the static `dist/` folder the app actually ships as. One specific trick
this app leans on: `vite.config.ts`'s `publicDir: "../content"` tells Vite "also serve/copy
whatever's in this folder, verbatim, at the site root" — which is how `content.json` (written by
the separate pipeline) ends up reachable at `fetch("/content.json")` with zero glue code connecting
the two halves of the repo. (**`@vitejs/plugin-react`** is the specific plugin, listed separately
in `package.json`, that teaches Vite how to handle JSX syntax and enables React Fast Refresh —
Vite's core doesn't know anything about React on its own; every framework needs its own plugin.)

**`react-router-dom`** — client-side routing: the URL bar changes (`/notes/d1`), and React swaps
which component is on screen, *without* a full page reload or a new request to a server. `main.tsx`
wraps the app in `<BrowserRouter>`, which uses the browser's real History API — meaning URLs look
like normal URLs (`/practice`, not `/#/practice`), at the cost of needing the actual server to know
to serve `index.html` for any of those paths too (see `pipeline/src/server.ts`'s catch-all route —
without it, refreshing on `/notes/d1` would 404, since there's no real file at that path). One
route, `/session/:setId`, is deliberately rendered *outside* the normal sidebar layout — the exam
runner is full-screen on purpose, "nothing competes with the questions."

## 5. Backend — Express, deliberately minimal

**Express** — a small HTTP server framework. `pipeline/src/server.ts` has a handful of application
routes (`POST /api/session`, `GET /api/me`, `POST /api/logout`, `GET`/`PUT /api/progress`) plus
static file serving and the SPA-fallback catch-all mentioned above — still small enough that
Express was chosen *because* the job is this small, rather than reaching for something heavier
(NestJS, a full REST framework with its own conventions) that would be solving problems this app
doesn't have.

**`better-sqlite3`** — a synchronous SQLite driver, the one real database in the stack
(`pipeline/src/db.ts`). Added for LAN multi-user support: progress used to be a single JSON file
(one person, no identity), and became one row per person in a `progress` table once "anyone on the
LAN gets their own progress" became a requirement — a real database, not a folder of per-user JSON
files, because a second process (the `mcp-server/` stdio server, see §6) also writes this same
file directly and needs a real transactional check-then-write, not a hopeful file-lock convention.
**Synchronous**, deliberately: this app's actual write cadence is human/LLM-paced, not
high-throughput, so there's no async I/O benefit worth the complexity of promise-wrapping every
query — `better-sqlite3`'s synchronous API reads like plain function calls (`db.prepare(...).run()`)
with none of that overhead. Every write still replaces the whole `ProgressState` JSON blob in one
column (`data TEXT`), not normalized into relational columns — see `CLAUDE.md`'s progress-adapter
section for why "no partial merges" is a deliberate rule, not a missing feature; SQLite here is
about per-user *rows*, not about normalizing what's *inside* each row.

**Password + session-cookie auth, no OAuth** — `pipeline/src/db.ts`'s `sessions` table plus an
HTTP-only cookie handles sessions; `pipeline/src/passwords.ts` handles passwords via `node:crypto`'s
built-in `scrypt` (self-describing `scrypt$N$r$p$salt$hash` format), not bcrypt/argon2 — this app's
threat model (a trusted LAN, not internet-facing) doesn't warrant a new native/WASM dependency for
argon2's stronger offline-cracking resistance. No password reset flow either: no SMTP exists in this
app, so recovery is the operator manually clearing an account's `password_hash`, documented in-app
rather than built as a self-service flow. Email is the sole identity key; a name (and, since issue
#46, a password) is asked once, on a genuinely new email, for display purposes only in the name's
case.

**`tsx`** — runs TypeScript files directly (`tsx src/server.ts`) without a separate "compile to
JS first" step. Used for both the CLI (`npm run build:content`) and, notably, as the **actual
production runtime inside the Docker container** — `pipeline/package.json` deliberately lists it
under `dependencies`, not `devDependencies`, because a production `npm ci --omit=dev` install would
otherwise silently lack it and the container would fail to start.

## 6. The MCP server — the same data, exposed as tools for an LLM agent

**MCP (Model Context Protocol)** — a standard way for an LLM-based agent (Claude Desktop, Claude
Code, a custom voice assistant) to call a fixed set of *typed* actions ("start a quiz session,"
"submit this answer") instead of scraping a web page or being handed raw file access. The agent
sees a menu of named tools with typed inputs/outputs; it doesn't need to know this app has a React
frontend at all. `mcp-server/src/index.ts` is a **stdio server** specifically — it talks
newline-delimited JSON-RPC over stdin/stdout to whatever process spawned it, no network port, no
auth, because the "client" is a process on your own machine, not a remote caller.

**`@modelcontextprotocol/sdk`** — the library that implements the MCP protocol itself (message
framing, the request/response lifecycle, the stdio transport) so `mcp-server/src/tools.ts` only has
to describe *what* each tool does, not how JSON-RPC works.

**Zod** — runtime schema validation. TypeScript's `interface`/`type` checks are compile-time only
and vanish the moment code actually runs — useless for validating a tool call's input, which
arrives over the wire as untyped JSON from a process you don't control. Zod schemas describe the
same shape but check it *at runtime*, rejecting a malformed tool call (wrong type, missing field)
with a clear error instead of it crashing three functions deeper or silently producing garbage.
Used for every tool's input schema in `mcp-server/src/tools.ts`.

This package deliberately imports `app/`'s and `pipeline/`'s source directly rather than
duplicating scoring/readiness logic — see `CLAUDE.md`'s "MCP server" section for exactly what it
reuses and why.

## 7. Containerization — Docker, Docker Compose

**Docker** — packages the app plus everything it needs to run (a specific Node version, installed
dependencies) into one portable image, so "works on my machine" becomes "works anywhere Docker
runs." The `Dockerfile` here is a **three-stage build**: one stage builds the frontend
(`npm run build`, needs the full `node_modules` including dev tools like TypeScript), a second
installs only the pipeline's *production* dependencies (`npm ci --omit=dev`, smaller, no test
libraries), and a third, final stage copies just the *outputs* of the first two into a clean image
— the actual shipped container never contains the frontend's dev dependencies or the pipeline's
test tooling, only what's needed to run.

**Docker Compose** — describes *how* to run that image: which ports to expose, which folders on
your real machine to mount inside the container. This app mounts two: `SnowPro_Notes_and_Questions/`
to `/content` (the pipeline only ever reads from here — nothing in the app writes back to it, though
the mount itself isn't filesystem-enforced read-only), and a local `data/` folder to `/data`, where
the server's identity/progress routes read/write `snowprep.sqlite`. Mounting instead of copying
means editing a markdown file on your real machine and running `docker compose restart` picks up
the change — no rebuild needed, since the pipeline re-reads `/content` fresh at every container
boot.

## 8. Dev tooling

**`oxlint`** — a linter (flags likely-bugs and style issues: unused variables, suspicious
comparisons) written in Rust for speed, used here instead of the more common ESLint mainly because
it's near-instant on a codebase this size, with zero config needed to get useful signal.

**`tsc`** (the TypeScript compiler, invoked as `tsc -b` in `app/`, `tsc --noEmit` in `pipeline/`)
— used here purely for **type-checking**, not for producing the actual JS that ships (Vite handles
that, faster, via esbuild under the hood). `-b` is "build mode" / project references, which lets
TypeScript check `app/`'s config as its own isolated unit rather than one flat project.

## 9. CI/CD — GitHub Actions, Dependabot

**GitHub Actions** — runs the same checks a developer would run locally (typecheck, test, lint,
plus a Docker build-and-boot smoke test) automatically on every push and pull request, so a
regression is caught before it's merged rather than the next time someone happens to run `npm
test`. Three independent jobs here, one per package (`pipeline/`, `app/`, `mcp-server/`), because
they aren't an npm workspace — each needs its own dependency install.

**Docker smoke test** — `docker compose build` + boot + a real `curl` against `localhost:8080`
inside CI. This isn't a deploy step (nothing here is deployed anywhere) — it's the closest thing
this project has to an integration test, since the container-boot path (`verifyDataDirWritable()`
then `runPipeline()` then bind the port, per `pipeline/src/server.ts`) is the one code path none
of the unit tests exercise end-to-end.

**Claude Code GitHub Action** (`anthropics/claude-code-action`) — a mention-driven assistant
(`@claude` in a PR/issue comment) that can review, diagnose a CI failure, or make a fix on request,
scoped by its system prompt to correctness/architecture/test-coverage rather than style (oxlint
already covers that). Deliberately on-demand only, not automatic on every PR — an earlier
automatic-review variant was removed on cost grounds (see `CLAUDE.md`'s CI/CD section) once real
per-PR spend came in, even though it did catch a genuine bug once.

**Dependabot** — opens a PR when a dependency has an update available, scanning each of the three
`package.json`/lockfile pairs plus the workflow files themselves, weekly rather than daily since
this is a low-traffic personal project and daily would just be noise.

---

For how these pieces fit together architecturally (which file does what, the data flow end to end,
known gotchas), see [`CLAUDE.md`](CLAUDE.md). For how to actually run the app, see
[`README.md`](README.md).
