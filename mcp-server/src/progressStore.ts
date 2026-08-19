/**
 * Reads/writes the owner's progress row in the same snowprep.sqlite database the web app's
 * container serves via GET/PUT /api/progress (pipeline/src/db.ts + pipeline/src/server.ts).
 * docker-compose.yml bind-mounts ./data:/data (not a named volume), so the host path this
 * resolves to by default *is* the literal file the running container also reads/writes — this
 * process shares state with the web app without any HTTP call between them, same as the
 * pre-SQLite flat-file version this replaces.
 *
 * `mcp-server/` has NO multi-user concept of its own (see the root CLAUDE.md and the LAN
 * multi-user plan) — it always operates on one fixed "owner" row: `SNOWPRO_OWNER_EMAIL` if set,
 * else whichever user account was created first (`findFirstUser()` — the returning owner
 * `pipeline/src/db.ts`'s migration creates on the very first login after this feature shipped).
 * If neither resolves to a real account (e.g. this server is run before anyone has ever logged
 * into the web app even once), `resolveOwner()` throws a clear, actionable error rather than
 * silently fabricating a phantom identity nobody asked for.
 *
 * Path resolution mirrors pipeline/src/config.ts's own pattern (walk up from this file's own
 * import.meta.url to the webapp root, then default to a fixed subfolder) rather than pipeline's
 * /data absolute default, since that default is Docker-only and doesn't exist on the host.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  openDb,
  findUserByEmail,
  findFirstUser,
  getProgressRow,
  writeProgressRow as dbWriteProgressRow,
  normalizeEmail,
  ProgressConflictError,
  type Db,
  type UserRow,
} from "../../pipeline/src/db.js";
import type { ProgressState } from "../../app/src/lib/progress.js";

export { ProgressConflictError };

const MCP_SERVER_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEBAPP_ROOT = path.dirname(MCP_SERVER_ROOT);
const DEFAULT_DATA_DIR = path.resolve(WEBAPP_ROOT, "data");

const DATA_DIR = path.resolve(process.env.SNOWPRO_DATA_DIR ?? DEFAULT_DATA_DIR);
const DB_FILE = path.join(DATA_DIR, "snowprep.sqlite");

/** Must match app/src/lib/progress.ts's defaultState() and pipeline/src/server.ts's
 *  defaultProgressState() — a third, intentional hand-copy (no npm workspace ties the three
 *  packages together; this mirrors server.ts's own shape exactly, including omitting `grades`
 *  from `flashcards`, since server.ts is this file's closest sibling — same contract). */
export function defaultProgressState(): ProgressState {
  return {
    schemaVersion: 1,
    examDate: null,
    lastLocation: null,
    attempts: [],
    inProgress: null,
    flashcards: { seen: [], lastIndex: 0, grades: {} },
    plan: { checked: [] },
    setup: { checked: [] },
    settings: { theme: "dark" },
  };
}

let dbSingleton: Db | undefined;
function getDb(): Db {
  if (!dbSingleton) dbSingleton = openDb(DB_FILE);
  return dbSingleton;
}

let ownerSingleton: UserRow | undefined;

/** Resolves the fixed "owner" account this whole module always reads/writes. Cached after first
 *  resolution — this server is a short-lived stdio process spawned fresh per MCP host connection,
 *  so the owner can't change mid-process (a login on a different browser tab elsewhere on the LAN
 *  creates or updates a *different* account, never this one, since `SNOWPRO_OWNER_EMAIL`/"first
 *  account" both name a specific fixed identity, not "whoever's currently logged in anywhere"). */
function resolveOwner(): UserRow {
  if (ownerSingleton) return ownerSingleton;
  const db = getDb();
  const ownerEmail = process.env.SNOWPRO_OWNER_EMAIL;
  if (ownerEmail) {
    const user = findUserByEmail(db, ownerEmail);
    if (!user) {
      throw new Error(
        `SNOWPRO_OWNER_EMAIL is set to "${normalizeEmail(ownerEmail)}", but no such account exists yet in ` +
          `${DB_FILE}. Log into the web app with that email once first (that creates the account), or unset ` +
          `SNOWPRO_OWNER_EMAIL to fall back to whichever account was created first.`,
      );
    }
    ownerSingleton = user;
    return user;
  }
  const first = findFirstUser(db);
  if (!first) {
    throw new Error(
      `No user accounts exist yet in ${DB_FILE}. The snowprep-quiz MCP server always operates on one fixed ` +
        `"owner" account (see mcp-server/README.md) — log into the web app at least once first (this creates ` +
        `the first account and, if a pre-upgrade progress.json exists, migrates it in), or set ` +
        `SNOWPRO_OWNER_EMAIL to a specific email and log into the web app with that exact email.`,
    );
  }
  ownerSingleton = first;
  return first;
}

export function readProgress(): ProgressState {
  const owner = resolveOwner();
  const row = getProgressRow(getDb(), owner.id);
  if (!row) return defaultProgressState();
  try {
    return { ...defaultProgressState(), ...JSON.parse(row.data) };
  } catch (err) {
    console.error(`readProgress: unreadable progress row for ${owner.email} in ${DB_FILE}: ${err}`);
    return defaultProgressState();
  }
}

/** The owner's current progress-row revision (an ISO timestamp, SQLite's stand-in for the flat
 *  file's old mtime-based revision — see db.ts's writeProgressRow() doc comment), or `"0"` if the
 *  owner has no progress row yet. Cheap: one indexed lookup by primary key, no JSON parsing. */
function currentRev(): string {
  const owner = resolveOwner();
  return getProgressRow(getDb(), owner.id)?.updatedAt ?? "0";
}

/** Always writes the whole object — no partial merges — matching the exact contract
 *  app/src/lib/progress.ts's updateProgress() and pipeline/src/server.ts's PUT route both honor.
 *
 *  `expectedRev` must be whatever `currentRev()` (or a prior `readProgress()` call paired with a
 *  `currentRev()` snapshot taken at the same time) returned *before* `next` was computed — pass it
 *  through `updateProgress()` below rather than calling this directly, so a conflict retries
 *  against fresh state instead of just failing once. Throws `ProgressConflictError` (re-exported
 *  from db.ts) when the row changed since `expectedRev` was captured — db.ts's `writeProgressRow()`
 *  does the actual check-then-write, inside a real `BEGIN IMMEDIATE` transaction so the check and
 *  the write are atomic against every other process with this same .sqlite file open (this
 *  process, and pipeline/'s Express process), not just within this one call. */
export function writeProgress(next: ProgressState, expectedRev: string): void {
  const owner = resolveOwner();
  dbWriteProgressRow(getDb(), owner.id, JSON.stringify(next), expectedRev);
}

type MutateResult<T> = { ok: true; next: ProgressState; value: T } | { ok: false; error: string };

/** Read-modify-write with automatic retry on a concurrent-writer conflict (see
 *  `ProgressConflictError` above). `mutate` receives freshly-read state on every attempt —
 *  including retries — so it must be a pure function of that state, never of anything captured
 *  earlier; a business-rule failure (e.g. "a session is already in progress") should return
 *  `{ok:false,...}`, which is returned immediately without retrying, since retrying can't fix
 *  that. Every session.ts write goes through this instead of calling readProgress()/
 *  writeProgress() directly. */
export function updateProgress<T>(
  mutate: (state: ProgressState) => MutateResult<T>,
  maxAttempts = 5,
): { ok: true; value: T } | { ok: false; error: string } {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rev = currentRev();
    const state = readProgress();
    const result = mutate(state);
    if (!result.ok) return result;

    try {
      writeProgress(result.next, rev);
      return { ok: true, value: result.value };
    } catch (err) {
      if (err instanceof ProgressConflictError && attempt < maxAttempts) continue;
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { ok: false, error: "Could not persist progress after repeated concurrent-write conflicts." };
}

export function dbFilePath(): string {
  return DB_FILE;
}

/** Test-only escape hatch: db.spec-style tests need a fresh owner resolution per test (a new
 *  temp .sqlite file, a newly-created first user) rather than this module's normal
 *  once-per-process caching, which is deliberate in production (see resolveOwner()'s own
 *  comment) but wrong inside a test suite that creates a new database per test. Not used by
 *  session.ts/tools.ts — production code never needs to un-cache the owner mid-process. */
export function __resetForTests(): void {
  dbSingleton?.close();
  dbSingleton = undefined;
  ownerSingleton = undefined;
}
