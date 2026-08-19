/**
 * SQLite-backed identity + progress storage (LAN multi-user support). Replaces the single flat
 * `data/progress.json` file with one row per user in a `progress` table, keyed by email (the only
 * identity lookup key — see `normalizeEmail()`). `name` is display-only and never used for lookups;
 * re-logging in with the same email but a different name just updates the existing row's `name`.
 *
 * Every exported function here takes an explicit `Db` handle rather than reaching for a hidden
 * module-level singleton (contrast with `mcp-server/src/progressStore.ts`'s env-var-at-import-time
 * pattern) — this is what lets `pipeline/test/db.spec.ts` open a real temp-file SQLite database per
 * test with no `vi.resetModules()`/env-var dance, and lets `mcp-server/src/progressStore.ts` reuse
 * this exact module against its own db path instead of duplicating the schema/logic a third time.
 *
 * `data`'s JSON blob keeps `ProgressState`'s shape (app/src/lib/progress.ts) completely untouched —
 * this module never parses or validates it beyond "is it well-formed JSON," matching the existing
 * flat-file contract in pipeline/src/server.ts / mcp-server/src/progressStore.ts exactly (always the
 * whole object, no partial merges, no schema enforcement beyond that boundary).
 */

import Database from "better-sqlite3";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";

export type Db = InstanceType<typeof Database>;

export interface UserRow {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface ProgressRow {
  /** The raw JSON text exactly as stored — callers that need the parsed object call
   *  `JSON.parse(row.data)` themselves; kept as a string here so a byte-for-byte round trip (e.g.
   *  the flat-file migration below) never risks a re-serialization difference. */
  data: string;
  /** The ETag/If-Match revision value (see `writeProgressRow()`) — an ISO timestamp with
   *  millisecond precision, not a monotonic counter, matching the flat file's mtime-as-revision
   *  convention this replaces (`pipeline/src/server.ts`'s `currentMtimeMs()`) closely enough that
   *  the client-side ETag/If-Match protocol in `app/src/lib/progress.ts` needs zero changes — it
   *  already treats this value as an opaque string, never parses it. */
  updatedAt: string;
}

/** Thrown by `writeProgressRow()` when the row's revision changed since the caller last read it —
 *  the direct SQLite-backed equivalent of `mcp-server/src/progressStore.ts`'s
 *  `ProgressConflictError` (same name, same meaning, same "optimistic concurrency, not a hard lock"
 *  caveat) and of `pipeline/src/server.ts`'s previous mtime-based 409 check. The write itself
 *  happens inside a `BEGIN IMMEDIATE` transaction (see `writeProgressRow()`), so the read-check-
 *  write is atomic against every other writer of this database file, not just other requests
 *  inside this one Node process — that matters here specifically because, unlike a browser tab's
 *  in-process races, `mcp-server/`'s stdio process opens this exact same `.sqlite` file directly
 *  from a second OS process. */
export class ProgressConflictError extends Error {
  constructor() {
    super(
      "This user's progress row changed since it was last read — most likely another writer " +
        "(a second browser tab, or the MCP quiz server) saved in between. Refusing to overwrite it blindly.",
    );
    this.name = "ProgressConflictError";
  }
}

/** Opens (creating if needed) the SQLite file at `filePath` and ensures the schema exists.
 *
 *  Deliberately NOT `journal_mode = WAL`, even though WAL is usually the right default for a
 *  small embedded-DB Node app: WAL requires the filesystem to support shared-memory (mmap of a
 *  `-shm` file) coordination between every process with the database open, and SQLite's own docs
 *  are explicit that this breaks down over a network filesystem ("all processes using a database
 *  must be on the same host computer; WAL does not work over a network filesystem"). This
 *  database's actual deployment is exactly that shape in disguise: `pipeline/src/server.ts` opens
 *  this file from *inside* the Docker Desktop Linux container via a bind mount, while
 *  `mcp-server/`'s stdio process opens the identical file directly from the Windows host's NTFS —
 *  two different filesystem-translation layers (Docker Desktop's bind-mount share, native NTFS
 *  locking) on what SQLite needs to treat as one consistent local disk. That's a well-documented
 *  real risk for WAL specifically (its locking primitives, not the classic rollback journal's),
 *  not a hypothetical one, and this app's write cadence (human/LLM-paced, not high-frequency) gets
 *  nothing from WAL's concurrent-reader benefit that's worth trading real user data's integrity
 *  for. Sticking with the default rollback journal, which coordinates through the same POSIX/
 *  Windows byte-range file locks this exact cross-platform pairing already has to get right for
 *  anything to work at all. `busy_timeout` still applies here too — it makes a second process's
 *  write wait briefly for the first process's write lock to clear instead of failing immediately
 *  with SQLITE_BUSY, independent of which journal mode is active. */
export function openDb(filePath: string): Db {
  const db = new Database(filePath);
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

/** Email is the ONLY identity lookup key (per the plan's explicit decision) — normalized by
 *  trimming and lowercasing before every insert/lookup, so "Person@Example.com" and
 *  "person@example.com" are always the same account. Lowercasing in JS rather than relying on
 *  SQLite's built-in `COLLATE NOCASE` deliberately: SQLite's NOCASE only folds ASCII a-z, while
 *  JS's `.toLowerCase()` does full Unicode case folding — this repo has no reason to assume every
 *  future user's email is ASCII-only. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(db: Db, email: string): UserRow | undefined {
  const row = db
    .prepare("SELECT id, email, name, created_at AS createdAt FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  return row;
}

export function findUserById(db: Db, id: number): UserRow | undefined {
  return db.prepare("SELECT id, email, name, created_at AS createdAt FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
}

/** The account the migration below treats as the returning owner, and the fallback
 *  `mcp-server/` uses when `SNOWPRO_OWNER_EMAIL` isn't set: whichever user row was created first
 *  (lowest id — `id` is `AUTOINCREMENT`, so this is exactly creation order). */
export function findFirstUser(db: Db): UserRow | undefined {
  return db.prepare("SELECT id, email, name, created_at AS createdAt FROM users ORDER BY id ASC LIMIT 1").get() as
    | UserRow
    | undefined;
}

export function usersCount(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  return row.n;
}

/** `POST /api/session`'s core, called two different ways per issue #41's "only ask for a name on
 *  a genuinely new email" flow:
 *   - `name` provided, email known -> update `name` in place if it actually changed (a typo'd name
 *     is self-correctable without losing the account, or this is SettingsPanel's explicit name
 *     edit), otherwise a no-op read (no write for an unchanged resubmit).
 *   - `name` provided, email unknown -> create the account (real signup).
 *   - `name` omitted, email known -> plain "log me back in" with nothing to change; returns the
 *     existing row untouched, no write at all.
 *   - `name` omitted, email unknown -> the one case this function does NOT handle; the caller
 *     (`server.ts`'s `POST /api/session`) must check `findUserByEmail` itself first and respond
 *     `{status: "new"}` without ever reaching this function, since there's no name to create the
 *     account with yet. Throws if called this way anyway, rather than silently doing nothing or
 *     fabricating a blank name — that would be a real caller bug, not a normal path. */
export function upsertUserOnLogin(db: Db, email: string, name?: string): UserRow {
  const normalized = normalizeEmail(email);
  const existing = findUserByEmail(db, normalized);
  if (existing) {
    if (name !== undefined && name !== existing.name) {
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, existing.id);
      return { ...existing, name };
    }
    return existing;
  }
  if (name === undefined) {
    throw new Error(
      "upsertUserOnLogin: no account exists for this email and no name was given to create one -- " +
        "the caller must check findUserByEmail() first and respond {status: \"new\"} instead of calling this.",
    );
  }
  const createdAt = new Date().toISOString();
  const info = db
    .prepare("INSERT INTO users (email, name, created_at) VALUES (?, ?, ?)")
    .run(normalized, name, createdAt);
  return { id: Number(info.lastInsertRowid), email: normalized, name, createdAt };
}

/** Session tokens: 32 random bytes (256 bits), hex-encoded — plenty to be unguessable, and a plain
 *  string so it drops straight into an HTTP-only cookie with no encoding concerns. */
export function createSession(db: Db, userId: number): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    new Date().toISOString(),
  );
  return token;
}

/** Resolves a session cookie's token to its user, or `undefined` if the token is missing/unknown
 *  (an expired-by-deletion or never-existed session — there's no separate expiry column; a session
 *  lives until `deleteSession()` removes it via `POST /api/logout`). */
export function resolveSession(db: Db, token: string): UserRow | undefined {
  const row = db
    .prepare(
      `SELECT users.id AS id, users.email AS email, users.name AS name, users.created_at AS createdAt
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`,
    )
    .get(token) as UserRow | undefined;
  return row;
}

export function deleteSession(db: Db, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getProgressRow(db: Db, userId: number): ProgressRow | undefined {
  const row = db.prepare("SELECT data, updated_at AS updatedAt FROM progress WHERE user_id = ?").get(userId) as
    | ProgressRow
    | undefined;
  return row;
}

/** Writes `dataJson` (already-serialized `ProgressState` JSON text) as `userId`'s progress row,
 *  the SQLite equivalent of the flat file's ETag/If-Match check: `expectedRev` must be whatever the
 *  caller's last read reported (`"0"` — matching `server.ts`'s existing "no revision yet" sentinel
 *  — if the row doesn't exist yet), and a mismatch throws `ProgressConflictError` instead of
 *  overwriting a write that happened in between.
 *
 *  The read-check-write happens inside `db.transaction(...).immediate(...)` (`BEGIN IMMEDIATE`),
 *  which takes SQLite's write lock up front — this closes the gap a plain SELECT-then-UPDATE would
 *  leave between the two statements, across every process with this file open (this container's
 *  Express process AND `mcp-server/`'s separate stdio process), not just within this one call.
 *
 *  Returns the new revision (the caller echoes it back as the response's ETag, same as before). */
export function writeProgressRow(db: Db, userId: number, dataJson: string, expectedRev: string): string {
  const newRev = new Date().toISOString();
  const run = db.transaction((uid: number, data: string, rev: string) => {
    const current = db.prepare("SELECT updated_at AS updatedAt FROM progress WHERE user_id = ?").get(uid) as
      | { updatedAt: string }
      | undefined;
    const currentRev = current?.updatedAt ?? "0";
    if (currentRev !== expectedRev) throw new ProgressConflictError();
    db.prepare(
      `INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ).run(uid, data, rev);
  });
  run.immediate(userId, dataJson, newRev);
  return newRev;
}

/** Called exactly once, only for the very first user account this database ever creates (the
 *  caller — `pipeline/src/server.ts`'s `POST /api/session` handler — checks `usersCount(db) === 0`
 *  *before* creating the account, and only then calls this). If the pre-upgrade flat file
 *  (`oldFilePath`, i.e. the old `data/progress.json`) still exists, imports its exact bytes as this
 *  user's progress row unchanged (no `JSON.parse`/re-`stringify` round trip — a real fixture test
 *  asserts this is byte-identical, not just "doesn't crash") and renames the old file to
 *  `${oldFilePath}.migrated` so it's never re-imported on a later restart. Returns whether an
 *  import actually happened (`false` for a genuinely fresh install with no prior single-user
 *  history — not an error).
 *
 *  Fails open on a corrupt old file: an unparseable `progress.json` must not (a) silently hand the
 *  brand-new first user a broken/garbage progress row, or (b) block them from logging in at all.
 *  It's still renamed aside so the same corrupt file doesn't get retried on every subsequent first-
 *  login attempt across container restarts. */
export function migrateFlatFileProgress(db: Db, userId: number, oldFilePath: string): boolean {
  if (!existsSync(oldFilePath)) return false;
  const raw = readFileSync(oldFilePath, "utf8");
  try {
    JSON.parse(raw);
  } catch (err) {
    console.error(`migrateFlatFileProgress: ${oldFilePath} is not valid JSON, skipping import: ${err}`);
    renameSync(oldFilePath, `${oldFilePath}.migrated`);
    return false;
  }
  writeProgressRow(db, userId, raw, "0");
  renameSync(oldFilePath, `${oldFilePath}.migrated`);
  return true;
}
