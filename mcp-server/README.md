# snowprep-mcp-server

An MCP (Model Context Protocol) server exposing the SnowPro Core Prep question bank and progress
tracking as tools, so a local LLM-based agent (Claude Desktop, Claude Code, or a custom voice
agent) can quiz you conversationally instead of requiring the web UI.

Runs as a local, stdio-transport MCP server — no network exposure, spawned directly by whatever
MCP host you register it with. It reads the question bank straight from
`SnowPro_Notes_and_Questions/` (via the same `runPipeline()` the main content pipeline uses — no
need for the Docker container to be running) and reads/writes one fixed user's row in
`../data/snowprep.sqlite` — **the exact same database file** the web app's container serves over
`GET`/`PUT /api/progress` (that path is a Docker bind mount, not a named volume, so this process
and the container share the literal same file on disk, no HTTP involved). Quiz sessions run here
show up in that one account's web-app Analytics/Dashboard, and vice versa.

**This server has no multi-user concept of its own** — the web app (as of the LAN multi-user
feature) supports multiple people, each identified by email, each with their own isolated
progress; this server always operates on one fixed "owner" account regardless of who else is
logged into the web app elsewhere on the LAN. See `SNOWPRO_OWNER_EMAIL` below for how that account
is chosen. The web app's login is email+password (issue #46) — this server itself has no concept of
that at all, since it reads/writes the owner's SQLite row directly and was never going to be
reachable by anyone but you in the first place; it needs no changes when the owner sets or changes
their password.

## Tools

| Tool | Purpose |
|---|---|
| `list_domains` | The 5 exam domains, their weight, and question counts. |
| `get_readiness` | Overall + per-domain readiness score, from attempt history. |
| `start_quiz_session` | Starts a session. Omit `domainId` to auto-pick the weakest domain. Only one session (shared with the web app) can be active at a time. |
| `get_next_question` | Next unanswered question in the session (never includes the answer). |
| `submit_answer` | Grades an answer (pass option keys like `["B"]`, not raw text — resolve the user's spoken answer to keys yourself using the question+options you already have). Returns verdict + explanation. |
| `end_quiz_session` | Finishes the session, records it as an attempt (visible in the web app too), returns the score. |
| `reset_progress` | Wipes ALL progress. Requires `confirm:"RESET"` (exact match) — only pass it after the user has explicitly confirmed. |
| `set_exam_date` | Sets or clears (`date:null`) the exam date. The study plan shifts to match. |
| `get_study_plan` | Full day-by-day plan remapped to the live exam date, each task's done status, each day flagged `isToday`/`isPast`. |
| `set_plan_task` | Marks one study-plan task done/not-done. |
| `get_setup_checklist` | The hands-on setup checklist (id/kind/group/title/done — not the full step text). `kind` distinguishes an actionable "step" from a "issue" (a known problem+fix, not a task). |
| `set_setup_step` | Marks one setup step done/not-done. |

Deliberately excluded: JSON import/export (the web UI's Settings backup feature) — pasting a
multi-KB JSON blob through a chat turn is an awkward conversational action, and the web UI's own
Export/Import buttons already cover it directly for whichever account needs it.

## Environment variables

- `SNOWPRO_DATA_DIR` — where `snowprep.sqlite` lives. Defaults to `<repo-root>/data` (the same
  folder `docker-compose.yml` bind-mounts to `/data` — leave unset to share state with the
  container automatically).
- `SNOWPRO_OWNER_EMAIL` — which web-app account this server reads/writes. If unset, it falls back
  to whichever account was created first (the returning owner the one-time flat-file migration
  creates on the very first login after upgrading to the multi-user feature — see
  `pipeline/src/db.ts`'s `migrateFlatFileProgress()`). Set this explicitly if you ever log into
  the web app with an email other than the one you want this server tied to, or if you want to be
  resilient to a future re-migration changing which account happens to be "first." If it's set to
  an email with no matching account yet, or if no accounts exist at all yet, this server refuses
  to start with a clear error rather than silently inventing a phantom account — log into the web
  app with the intended email at least once first.
- `SNOWPRO_CONTENT_SOURCE` — the markdown source folder. Defaults to
  `<repo-root>/SnowPro_Notes_and_Questions`, same as the pipeline's own default.

## Running it

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test             # vitest run
npm start             # tsx src/index.ts — talks JSON-RPC over stdio, not meant to be run bare
```

`npm start` waits on stdin for an MCP client — running it directly in a terminal will look like it
hangs; that's expected. Boot status (question count, bankVersion) prints to **stderr**, never
stdout, since stdout is reserved entirely for the JSON-RPC protocol stream.

## Registering with a local MCP host

**Claude Code**, from the repo root:
```bash
claude mcp add snowprep-quiz -- npx tsx mcp-server/src/index.ts
```

**Claude Desktop**, add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "snowprep-quiz": {
      "command": "npx",
      "args": ["tsx", "C:\\path\\to\\Snowpro Core Exam Webapp\\mcp-server\\src\\index.ts"]
    }
  }
}
```
Use an absolute path to `src/index.ts` — Claude Desktop doesn't run from this repo's directory.

## Manual test recipe (no MCP host needed)

Any MCP client works, including the official inspector:
```bash
npm run inspect   # npx @modelcontextprotocol/inspector tsx src/index.ts — opens a browser UI
```

Or drive it directly with raw JSON-RPC over stdio (what the automated tests below do): pipe
`initialize` → `notifications/initialized` → `tools/call` messages into `tsx src/index.ts` and
read newline-delimited JSON responses from stdout.

Suggested walkthrough once connected: `list_domains` → `get_readiness` → `start_quiz_session`
(no args — confirm it picks your actual weakest domain) → `get_next_question` →
`submit_answer` a few times → `end_quiz_session` → `get_readiness` again, confirming that domain's
score moved. Then log into the running web app as the owner account (see `SNOWPRO_OWNER_EMAIL`
above) and confirm the attempt shows up on its Analytics page too.

## Design notes (why it's built this way)

- **No npm workspace.** `pipeline/` and `app/` aren't linked (see the root `CLAUDE.md`), so this
  package imports their `.ts` source directly via relative path, matching how `pipeline/src/`
  already imports across its own files. `tsconfig.json` uses `"moduleResolution": "bundler"`
  specifically so it tolerates both `pipeline/`'s `.js`-suffixed relative imports (its own
  NodeNext convention) and `app/`'s unsuffixed ones (its own Vite/bundler convention) in the same
  program — the two packages were never meant to be typechecked together, and this is the
  compatibility shim that lets that happen without editing either one.
- **Never import a runtime value from `app/src/lib/progress.ts`.** Its module top level calls
  `localStorage.getItem(...)` unconditionally — importing anything but `import type { ... }` from
  it crashes immediately in Node. `progressStore.ts` hand-copies its own
  `defaultProgressState()` instead (a third copy, after `app/`'s and `pipeline/src/server.ts`'s —
  consistent with this repo's existing convention of small hand-duplicated shapes across its
  three unlinked packages).
- **Grading and readiness math are never reimplemented** — `session.ts` calls
  `app/src/lib/scoring.ts`'s `questionCredit`/`scaledScore`/`byDomainBreakdown` and
  `app/src/lib/readiness.ts`'s `overallReadiness` directly, so a quiz taken here is scored
  identically to one taken in the web app.
