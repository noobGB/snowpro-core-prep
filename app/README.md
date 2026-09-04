# `app/` — the frontend

The React + Vite single-page app. One of this repo's three independent npm packages (`pipeline/`,
`app/`, `mcp-server/` — deliberately not a workspace; see the root [`CLAUDE.md`](../CLAUDE.md)).

**Start with the [root README](../README.md)** for what the project is and how to run the whole
thing. This file only covers what is specific to building the frontend on its own.

## Running just the frontend

```bash
npm install
npm run dev      # Vite dev server
```

Without the container there is no `/api` backend, so the app detects that and falls back to
`localStorage` for progress — you get the full UI with no login gate. See `src/lib/progress.ts` and
`src/lib/session.ts` for how that probe works.

The dev server needs generated content to exist. Build it once from the sibling package:

```bash
cd ../pipeline && npm run build:content
```

`vite.config.ts` points `publicDir` at `../content`, so the pipeline's output is served at the site
root without a copy step.

## Checks

```bash
npx tsc -b --noEmit   # NOT `tsc --noEmit` — see below
npm run lint          # oxlint
npm test              # vitest
npm run build         # tsc -b && vite build
```

**`tsc --noEmit` is not a typecheck here.** `tsconfig.json` is solution-style (`"files": []` plus
references to `tsconfig.app.json` / `tsconfig.node.json`), so a bare `tsc --noEmit` resolves zero
files and exits 0 unconditionally — it will happily "pass" with obvious type errors in the source.
Use `tsc -b --noEmit`, which resolves the project references. `ci.yml` carries the same warning for
the same reason.

## Layout

| Path | What lives there |
|---|---|
| `src/pages/` | One file per route (`Dashboard`, `Runner`, `Results`, `Analytics`, …) |
| `src/components/` | Shared UI — the shell, sidebar, settings panel, auth form, banners |
| `src/lib/` | Non-visual logic: scoring, readiness, timing, plan dates, progress persistence, session |
| `src/styles/tokens.css` | Design tokens and the handful of CSS classes that inline styles can't express |

`src/lib/` is where the real logic lives, and it is the only part with unit tests — `scoring.ts` and
`readiness.ts` are additionally imported *directly* by `mcp-server/`, so one scoring engine backs
both the web app and the MCP server. Changing their signatures affects that package too.

Styling is inline React style objects plus CSS custom properties from `tokens.css`. There is no CSS
framework and no component library, deliberately.
