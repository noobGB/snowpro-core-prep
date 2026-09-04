# Security policy

## Reporting a vulnerability

Please report security issues **privately** via GitHub's
[Report a vulnerability](https://github.com/noobGB/snowpro-core-prep/security/advisories/new)
form rather than opening a public issue.

Expect a first response within a few days. This is a personal project maintained by one person in
their own time — fixes are best-effort, and there is no bug bounty.

## What is in scope

The application in this repository and the container image published from it:

- Authentication and session handling (`pipeline/src/server.ts`, `db.ts`, `passwords.ts`, `oauth.ts`)
- The guest/demo account path, which is the one unauthenticated endpoint that writes to the database
- Progress data isolation between accounts on a shared instance
- The admin routes and role checks
- Anything that lets one user read or modify another user's data

## What is out of scope

- **The hosted demo's content.** Practice questions, notes and the full content bundle at
  `/content.json` are served publicly on purpose — this is an MIT-licensed repository and the same
  material is in the source tree. That is a deliberate decision, not an access-control bug.
- **Missing rate limits on read-only endpoints.** The write paths are limited; reads are not, and
  that is accepted for a project of this size.
- Anything requiring physical or already-privileged access to the machine running the container.
- Findings from automated scanners with no demonstrated impact.

## Deploying this yourself

Two things matter more than anything else in this file if you self-host:

- **Set `SNOWPRO_ADMIN_EMAILS`** on any instance reachable from the internet. Without it, admin
  goes to whichever account is created first — which, on a fresh public deployment, can be a
  stranger rather than you.
- **Leave `SNOWPRO_ENABLE_GUEST` unset** unless you actually want the public demo path. It adds an
  endpoint that writes a database row with no authentication, which a private or LAN instance gains
  nothing from.

See [`.env.example`](.env.example) for the full list of variables and what each one does.
