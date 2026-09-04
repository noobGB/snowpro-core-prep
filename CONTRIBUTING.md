# Contributing

Thanks for taking a look at this project — contributions, bug reports, and questions are welcome.

This is a personal project maintained solo, so response times aren't guaranteed, but real issues
and well-scoped PRs do get looked at. If you're an AI coding agent working in this repo, read
[`CLAUDE.md`](CLAUDE.md) instead — it's written specifically for that; this file is for humans.

## Reporting a bug

Open an [issue](https://github.com/noobGB/snowpro-core-prep/issues/new/choose) with:

- What you expected to happen vs. what actually happened
- Steps to reproduce (which page, what you clicked/typed)
- Whether you're running via Docker (`docker compose up`) or local dev, and your OS/browser
- Relevant log output — `docker compose logs`, or your browser console, whichever applies

## Suggesting a feature

Open an issue describing the problem it solves, not just the feature itself — that's usually
enough to tell whether it fits the project's scope (a small, self-hosted, LAN-only study tool) or
would be better as your own fork.

## Setting up a dev environment

The full setup (Docker, or each package's own commands for local dev without Docker) is in
[README.md](README.md#start-preparing-in-minutes) — not duplicated here, so it can't drift out of
sync in two places. Short version:

```bash
git clone <this-repo-url> snowpro-core-prep
cd snowpro-core-prep
docker compose build
docker compose up -d
```

`pipeline/`, `app/`, and `mcp-server/` are three separate npm packages (not a workspace) — each
needs its own `npm install`. See [`CLAUDE.md`](CLAUDE.md)'s per-package "Commands" subsections for
the full list (typecheck, test, dev server, etc.) if you're changing code rather than just running
the app.

## Submitting a change

This repo follows the workflow documented in [`CLAUDE.md`](CLAUDE.md)'s "Development workflow"
section — the short version:

1. **File an issue first** for anything beyond a trivial fix/typo, so there's a record of what the
   change is and why before any code exists. Small, obviously-scoped edits can skip this.
2. **Branch off `master`** — `fix/issue-<N>-<slug>` or `feat/issue-<N>-<slug>`.
3. **Match the existing style**: `npm run typecheck`/`tsc -b --noEmit`, `npm test`, and (for `app/`)
   `npm run lint` should all pass locally before you open a PR — CI runs the same checks and won't
   merge on red. Doc comments in this codebase favor explaining *why* a non-obvious decision was
   made over restating *what* the code does.
4. **Check [`DOCS_MAP.md`](DOCS_MAP.md)** if your change touches a topic it tracks (identity/auth,
   theming, the content pipeline, Docker/CI, …) — it maps each subsystem to exactly which doc
   files/sections need a matching update, so stale docs don't slip through.
5. **Open a PR** with `Closes #<N>` in the body (if there's an issue) and a short summary of what
   changed and why. Include a before/after screenshot for anything with a visible UI effect.
6. One logical change per PR — keeps review, CI, and any future revert scoped to just that change.

By submitting a change, you agree it's licensed under this repo's [MIT License](LICENSE).
