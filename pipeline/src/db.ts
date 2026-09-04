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

export type UserRole = "user" | "admin";

export interface UserRow {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  /** `null` for a legacy pre-password account (issue #37) that hasn't claimed a password yet --
   *  see `setPasswordIfUnset()`/`setPassword()` and server.ts's three-state `POST /api/session`
   *  flow. Never populated by `upsertUserOnLogin()` except at account-creation time. */
  passwordHash: string | null;
  /** Issue #62: "admin" unlocks the `/admin` page and `/api/admin/*` routes (`requireAdmin`
   *  middleware in server.ts). Defaults to "user"; see `addRoleColumnIfMissing()` for how the
   *  very first account (fresh OR pre-existing database) ends up "admin". */
  role: UserRole;
  /** Issue #62: `true` for an admin-provisioned account that hasn't set its own password yet --
   *  the account has a real (temporary) `passwordHash` already, unlike the legacy `null` case
   *  above, but `POST /api/session` still forces a change before issuing a session. Cleared by
   *  `completeMustChangePassword()`, and also by `setPassword()`/`setPasswordIfUnset()`/
   *  `completePasswordReset()` — any path that sets a real password satisfies this. */
  mustChangePassword: boolean;
  /** Google's stable, permanent subject ID for this account (issue #113) -- `null` for an account
   *  that has never signed in with Google. Not the login lookup key (email still is, via the
   *  unique `users.email` column) -- this is a secondary identifier, recorded so a future
   *  "disconnect Google" admin action or a support question ("how did this account sign up") has a
   *  real answer instead of a guess. Set once, on first Google sign-in, by `linkGoogleAccount()`. */
  googleSub: string | null;
  /** `true` for an ephemeral demo account minted by `createGuestUser()` (the "Explore the demo"
   *  button on the public home page). A guest is a *real* row on purpose: progress, scoring,
   *  readiness and analytics then work with zero new code paths, and two concurrent visitors are
   *  isolated by construction. Reaped after a TTL of inactivity by `reapGuests()`, or promoted to
   *  a permanent account in place by `upgradeGuest()`.
   *
   *  Anything that asks "is this a real person's account" must filter on this -- see
   *  `humanUsersCount()` and `findFirstUser()` for the two places where forgetting to would have
   *  quietly broken admin bootstrap and MCP owner resolution. */
  isGuest: boolean;
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

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
  addPasswordHashColumnIfMissing(db);
  addRoleColumnIfMissing(db);
  addMustChangePasswordColumnIfMissing(db);
  addGoogleSubColumnIfMissing(db);
  addIsGuestColumnIfMissing(db);
  return db;
}

/** Issue #46: adds `users.password_hash` (nullable -- legacy accounts start unset) on top of the
 *  `CREATE TABLE IF NOT EXISTS` shape above, which never runs again once the table already exists.
 *  SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so idempotency is checked explicitly
 *  via `PRAGMA table_info` rather than wrapping the ALTER in a try/catch -- swallowing the
 *  exception would also swallow a real failure (disk full, a locked file) indistinguishably from
 *  "column already exists." A real migrations-versioning table is premature for this one
 *  additive, nullable column on a single deployment target; revisit if a second ALTER shows up. */
function addPasswordHashColumnIfMissing(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === "password_hash")) return;
  db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
}

/** Issue #62: adds `users.role` (`TEXT NOT NULL DEFAULT 'user'`) the same idempotent
 *  `PRAGMA table_info`-guarded way as `addPasswordHashColumnIfMissing()` above — plus, in that
 *  same one-time pass, bootstraps an admin for a database that predates this column entirely: if
 *  no row is already `'admin'` and at least one user exists, the lowest-`id` (earliest-created,
 *  same convention `findFirstUser()` uses) user is promoted. This is what makes the *live*
 *  database (which already has real accounts from before issue #62) end up with an admin without
 *  a manual step, using the same rule `POST /api/session`'s `isFirstEverAccount` check applies to
 *  a brand-new database going forward. Guarded so it only ever runs this backfill once — a second
 *  admin promoted later (or the original demoted) must never be silently overridden back. */
function addRoleColumnIfMissing(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === "role")) return;
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  const earliest = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
  if (earliest) db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(earliest.id);
}

function addMustChangePasswordColumnIfMissing(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === "must_change_password")) return;
  db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
}

/** Issue #113 (Google OAuth login): adds `users.google_sub`, same idempotent
 *  `PRAGMA table_info`-guarded pattern as the columns above. Nullable, no `UNIQUE` constraint at
 *  the SQL level -- `findUserByGoogleSub()`/`linkGoogleAccount()`'s caller (the OAuth callback
 *  route) already has to look it up before linking, so enforcing uniqueness in application code
 *  there is no extra work, and avoids a second migration if this column's constraints ever need to
 *  change. */
/** Adds `users.is_guest` for the demo-mode accounts (see `UserRow.isGuest`), in the same
 *  `PRAGMA table_info`-guarded way as the columns above.
 *
 *  `INTEGER NOT NULL DEFAULT 0` rather than nullable: every row that already exists is a real
 *  person's account, and that has to be true of them *immediately* on upgrade, not once something
 *  backfills. A nullable column would make `is_guest = 0` filters silently miss every pre-existing
 *  row, which is exactly the direction this must never fail in -- `reapGuests()` deletes rows. */
function addIsGuestColumnIfMissing(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === "is_guest")) return;
  db.exec("ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
}

function addGoogleSubColumnIfMissing(db: Db): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (columns.some((c) => c.name === "google_sub")) return;
  db.exec("ALTER TABLE users ADD COLUMN google_sub TEXT");
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

const USER_COLUMNS =
  "id, email, name, created_at AS createdAt, password_hash AS passwordHash, role, " +
  "must_change_password AS mustChangePassword, google_sub AS googleSub, is_guest AS isGuest";

/** better-sqlite3 returns `INTEGER` columns as raw JS numbers, not booleans — every query that
 *  selects `must_change_password AS mustChangePassword` via `USER_COLUMNS` (or the equivalent
 *  hand-written column list in `resolveSession()`) needs this to actually produce a `boolean` for
 *  `UserRow.mustChangePassword`, not a `0 | 1` silently mistyped as one. Same for `is_guest`. */
type RawUserRow = Omit<UserRow, "mustChangePassword" | "isGuest"> & {
  mustChangePassword: number;
  isGuest: number;
};
function toUserRow(row: RawUserRow): UserRow {
  return { ...row, mustChangePassword: row.mustChangePassword !== 0, isGuest: row.isGuest !== 0 };
}

export function findUserByEmail(db: Db, email: string): UserRow | undefined {
  const row = db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`)
    .get(normalizeEmail(email)) as RawUserRow | undefined;
  return row && toUserRow(row);
}

export function findUserById(db: Db, id: number): UserRow | undefined {
  const row = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as RawUserRow | undefined;
  return row && toUserRow(row);
}

/** Issue #113: the fast path for a returning Google sign-in -- once an account has been linked
 *  (see `linkGoogleAccount()`), this finds it directly by Google's stable subject ID rather than
 *  needing an email lookup. The OAuth callback route only falls back to `findUserByEmail()` when
 *  this returns nothing (a Google sign-in that's either genuinely new, or linking to an existing
 *  password-based account for the first time). */
export function findUserByGoogleSub(db: Db, sub: string): UserRow | undefined {
  const row = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE google_sub = ?`).get(sub) as RawUserRow | undefined;
  return row && toUserRow(row);
}

/** The account the migration below treats as the returning owner, and the fallback
 *  `mcp-server/` uses when `SNOWPRO_OWNER_EMAIL` isn't set: whichever user row was created first
 *  (lowest id — `id` is `AUTOINCREMENT`, so this is exactly creation order). */
export function findFirstUser(db: Db): UserRow | undefined {
  const row = db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE is_guest = 0 ORDER BY id ASC LIMIT 1`)
    .get() as RawUserRow | undefined;
  return row && toUserRow(row);
}

export function usersCount(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  return row.n;
}

/** Real people's accounts only, excluding demo guests.
 *
 *  This exists because `usersCount(db) === 0` was the admin-bootstrap test in server.ts's
 *  `POST /api/session` ("the first ever account becomes admin"). Once guests can be minted by an
 *  anonymous visitor, that test breaks in a way nobody would notice until it mattered: a guest
 *  arriving before the operator's own first signup makes the count non-zero, so the operator
 *  signs up as a plain user and is locked out of `/admin` permanently, on a brand new
 *  self-hosted instance. Guests must never count toward "has anyone signed up yet". */
export function humanUsersCount(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_guest = 0").get() as { n: number };
  return row.n;
}

/** Live demo-guest rows, for the admin page's "N active guest sessions" line. */
export function guestUsersCount(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_guest = 1").get() as { n: number };
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
 *     fabricating a blank name — that would be a real caller bug, not a normal path.
 *
 *  `passwordHash` (issue #46) is only ever consulted on the creation branch -- a brand new
 *  account gets its password set at creation time, alongside the name, in the same INSERT. It's
 *  never used to touch an *existing* account's password; that's `setPasswordIfUnset()`/
 *  `setPassword()`'s job below, kept separate so this function's existing "update name in place"
 *  contract for known users stays exactly as issue #41 left it.
 *
 *  `role` (issue #62) is likewise only consulted on creation -- `server.ts`'s `POST /api/session`
 *  passes `"admin"` on the one call that creates the very first account on a fresh database
 *  (`isFirstEverAccount`); every other caller omits it and gets the `"user"` default. */
export function upsertUserOnLogin(
  db: Db,
  email: string,
  name?: string,
  passwordHash?: string,
  role: UserRole = "user",
): UserRow {
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
    .prepare("INSERT INTO users (email, name, created_at, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .run(normalized, name, createdAt, passwordHash ?? null, role);
  return {
    id: Number(info.lastInsertRowid),
    email: normalized,
    name,
    createdAt,
    passwordHash: passwordHash ?? null,
    role,
    mustChangePassword: false,
    googleSub: null,
    // This is the ordinary signup/login path, never the guest path -- guests are only ever created
    // by createGuestUser(), which is the single place is_guest is set to 1.
    isGuest: false,
  };
}

/** Issue #46's atomic account-claiming step: sets `password_hash` for a legacy account that
 *  doesn't have one yet, guarded by `AND password_hash IS NULL` so the UPDATE itself -- not a
 *  preceding SELECT -- is the race guard. Two concurrent claims against the same legacy email can
 *  both run this statement, but SQLite serializes writes to the same row, so only the first to
 *  actually commit sees `changes === 1`; the second sees `changes === 0` because by the time its
 *  UPDATE runs, `password_hash IS NULL` is no longer true. Returns whether *this* call won the
 *  race -- the caller (`server.ts`) must treat `false` as "someone else claimed it first, try
 *  logging in with their password" rather than silently proceeding. */
export function setPasswordIfUnset(db: Db, userId: number, passwordHash: string): boolean {
  const info = db
    .prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ? AND password_hash IS NULL",
    )
    .run(passwordHash, userId);
  return info.changes === 1;
}

/** An authenticated password change (or the Settings "set a password" path for an already
 *  logged-in legacy account, which needs no *current* password since a live session already
 *  proves ownership) -- unlike `setPasswordIfUnset()`, this always overwrites, since the caller
 *  already holds a valid session for this exact user. Also deletes every OTHER session for this
 *  user (`keepToken` survives), so a password change actually locks out anyone using a stale
 *  session elsewhere rather than leaving it valid indefinitely -- this matters more than usual
 *  here because sessions have no expiry column and this app's cookies are issued with a 400-day
 *  max-age. */
export function setPassword(db: Db, userId: number, passwordHash: string, keepToken?: string): void {
  const run = db.transaction((uid: number, hash: string, keep: string | undefined) => {
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hash, uid);
    if (keep) {
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(uid, keep);
    } else {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(uid);
    }
  });
  run(userId, passwordHash, keepToken);
}

/** Issue #113: records that this account has signed in with Google -- called by the OAuth callback
 *  route the first time a given Google account is seen for this user, whether that's a brand new
 *  account or an existing password-based account with the same verified email. Idempotent: safe to
 *  call again on every subsequent Google sign-in even though `findUserByGoogleSub()` will short-
 *  circuit the caller before it gets here in that case. No `UNIQUE` constraint to violate (see
 *  `addGoogleSubColumnIfMissing()`'s comment) -- the caller already looked this sub up via
 *  `findUserByGoogleSub()` before deciding to link, so a second Google account colliding with an
 *  already-linked sub isn't a case this function needs to defend against itself. */
export function linkGoogleAccount(db: Db, userId: number, sub: string): void {
  db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").run(sub, userId);
}

// 400 days is Chrome's own hard cap on Set-Cookie Max-Age (a longer value gets silently clamped to
// this) — used deliberately as a long-lived "remember this device" session, matching the
// no-password design's whole point: logging in once shouldn't need repeating every browser
// restart. Exported so server.ts's cookie Max-Age and resolveSession()'s server-side expiry check
// below share the exact same value and can't drift apart — a session that's expired server-side
// but whose cookie somehow still exists client-side (a very long-running tab, a manually copied
// cookie) must behave identically to one whose cookie itself already expired.
export const SESSION_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

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

/** Resolves a session cookie's token to its user, or `undefined` if the token is missing/unknown,
 *  or (issue #142) older than `maxAgeMs` (defaults to `SESSION_MAX_AGE_MS`, matching the cookie's
 *  own lifetime). Previously a session lived forever once issued — there was no expiry at all
 *  server-side, only explicit deletion (`POST /api/logout`, a password change). A stale session
 *  found past its own age limit is deleted here too, not just ignored, so it doesn't linger in the
 *  table forever past its stated lifetime. Checked as a cheap, separate lookup first (the `token`
 *  primary-key index makes this trivial) so the age check never has to touch or reshape the main
 *  user-lookup query/its `RawUserRow` typing below. */
export function resolveSession(db: Db, token: string, maxAgeMs: number = SESSION_MAX_AGE_MS): UserRow | undefined {
  const session = db.prepare("SELECT created_at FROM sessions WHERE token = ?").get(token) as { created_at: string } | undefined;
  if (!session) return undefined;
  if (Date.now() - new Date(session.created_at).getTime() > maxAgeMs) {
    deleteSession(db, token);
    return undefined;
  }
  const row = db
    .prepare(
      // Keep this list in sync with USER_COLUMNS. It's hand-written because of the JOIN's table
      // qualifiers, and the `as RawUserRow` cast below means TypeScript cannot check it: a column
      // omitted here arrives as `undefined` and is silently coerced by toUserRow(). That is not
      // theoretical -- omitting is_guest makes `undefined !== 0` evaluate true, flagging every
      // signed-in real user as a guest.
      `SELECT users.id AS id, users.email AS email, users.name AS name, users.created_at AS createdAt,
              users.password_hash AS passwordHash, users.role AS role,
              users.must_change_password AS mustChangePassword, users.google_sub AS googleSub,
              users.is_guest AS isGuest
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`,
    )
    .get(token) as RawUserRow | undefined;
  return row && toUserRow(row);
}

export function deleteSession(db: Db, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** Issue #59's forgot-password flow: 32 random bytes hex, same shape as `createSession()`'s
 *  session tokens, but carrying an `expires_at` (the first token in this app with one — sessions
 *  never expire, they only get deleted). Any token(s) already outstanding for this user are deleted
 *  first, so requesting a new reset link invalidates a previously-emailed one rather than leaving
 *  two simultaneously valid. */
export function createPasswordResetToken(db: Db, userId: number, ttlMs: number): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const run = db.transaction((uid: number, tok: string) => {
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(uid);
    db.prepare(
      "INSERT INTO password_resets (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    ).run(tok, uid, new Date(now).toISOString(), new Date(now + ttlMs).toISOString());
  });
  run(userId, token);
  return token;
}

/** Atomically resolves and consumes a reset token, per issue #59 — mirrors
 *  `setPasswordIfUnset()`'s "the UPDATE/DELETE itself is the guard" idiom rather than a preceding
 *  SELECT: everything happens inside one transaction, so a token can never be used twice even if
 *  two requests race on it (SQLite serializes writes to the same row; whichever commits first wins,
 *  the second finds the row already gone). Returns `false` for a missing OR expired token — the
 *  caller doesn't need to distinguish the two, both mean "ask for a new link." On success, also
 *  deletes every session for this user (same as `setPassword()`'s no-`keepToken` branch — there's
 *  no live session to preserve here, unlike an authenticated password change). */
export function completePasswordReset(db: Db, token: string, newPasswordHash: string): boolean {
  const run = db.transaction((tok: string, hash: string): boolean => {
    const row = db
      .prepare("SELECT user_id AS userId, expires_at AS expiresAt FROM password_resets WHERE token = ?")
      .get(tok) as { userId: number; expiresAt: string } | undefined;
    if (!row || new Date(row.expiresAt).getTime() <= Date.now()) return false;
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hash, row.userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.userId);
    db.prepare("DELETE FROM password_resets WHERE token = ?").run(tok);
    return true;
  });
  return run(token, newPasswordHash);
}

// --- Issue #62: admin user management. ---

export interface AdminUserRow {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  role: UserRole;
  hasPassword: boolean;
  mustChangePassword: boolean;
  sessionCount: number;
}

/** Backs `GET /api/admin/users` — same shape as `admin-users.mjs`'s own `list` query (id, email,
 *  name, role, createdAt, hasPassword, mustChangePassword, live session count), returned as data
 *  instead of printed, for the `/admin` page's table. No pagination -- this app targets a small
 *  LAN/group, matching the CLI's own unpaginated style.
 *
 *  Demo guests are excluded. They are ephemeral, self-reaping and unmanageable (there is no useful
 *  admin action to take on one), and on a public deployment they would outnumber real accounts by
 *  orders of magnitude -- an unpaginated table listing them is not a table anyone can use. The
 *  count is surfaced separately via `guestUsersCount()`. */
export function listAllUsers(db: Db): AdminUserRow[] {
  const rows = db
    .prepare(
      `SELECT users.id AS id, users.email AS email, users.name AS name,
              users.created_at AS createdAt, users.role AS role,
              users.password_hash IS NOT NULL AS hasPassword,
              users.must_change_password AS mustChangePassword,
              (SELECT COUNT(*) FROM sessions WHERE sessions.user_id = users.id) AS sessionCount
       FROM users
       WHERE users.is_guest = 0
       ORDER BY users.id`,
    )
    .all() as Array<Omit<AdminUserRow, "hasPassword" | "mustChangePassword"> & { hasPassword: number; mustChangePassword: number }>;
  return rows.map((r) => ({ ...r, hasPassword: r.hasPassword !== 0, mustChangePassword: r.mustChangePassword !== 0 }));
}

/** Admin-provisioning a new account (issue #62) — deliberately separate from
 *  `upsertUserOnLogin()`, whose "update the existing row in place" semantics are wrong here: this
 *  is "create a new identity," not "log in," so an already-taken email must fail, not silently
 *  update someone else's account. Returns `null` for that case rather than throwing -- a normal,
 *  expected outcome the caller (the `POST /api/admin/users` route) reports back to the admin as a
 *  400, not a 500. Always `role: "user"` and `must_change_password: 1` -- promoting to admin is a
 *  separate, explicit `setUserRole()` call, never bundled into creation. */
export function createUserByAdmin(db: Db, email: string, name: string, passwordHash: string): UserRow | null {
  const normalized = normalizeEmail(email);
  if (findUserByEmail(db, normalized)) return null;
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (email, name, created_at, password_hash, role, must_change_password)
       VALUES (?, ?, ?, ?, 'user', 1)`,
    )
    .run(normalized, name, createdAt, passwordHash);
  return {
    id: Number(info.lastInsertRowid),
    email: normalized,
    name,
    createdAt,
    passwordHash,
    role: "user",
    mustChangePassword: true,
    googleSub: null,
    isGuest: false,
  };
}

/** Mints an ephemeral demo account for an anonymous visitor ("Explore the demo").
 *
 *  A real `users` row, deliberately, rather than a synthetic session or a shared demo account:
 *   - `progress.user_id` is a foreign key into `users`, so there is no way to persist a guest's
 *     progress without one anyway;
 *   - a *shared* account would be actively broken under launch traffic, because `writeProgressRow()`
 *     is optimistic-concurrency on a single row per user -- two concurrent visitors would produce a
 *     permanent 409 storm and each would see the other's attempts.
 *  Being a real row means every downstream consumer (scoring, readiness, analytics, the runner)
 *  needs no guest-awareness at all.
 *
 *  Two details that matter for security, not tidiness:
 *   - `@guest.invalid` uses the RFC 2606 reserved TLD, which is guaranteed never to resolve. If a
 *     future code path ever tries to email a guest, it cannot reach a real person.
 *   - `password_hash` is an unusable sentinel, NOT `null`. `null` would put the row into
 *     `POST /api/session`'s legacy "claim a password for this account" branch (`setPasswordIfUnset`),
 *     so anyone who learned a guest's email could claim the account. With an unusable value there is
 *     no path in except the session cookie, and no path out except `upgradeGuest()`.
 *
 *     The sentinel is deliberately NOT a real scrypt hash of random bytes, which was the first cut.
 *     `verifyPassword()` rejects any stored value that isn't 6 `$`-separated fields led by its algo
 *     tag, and it does so BEFORE deriving anything -- so this is unusable by construction, with no
 *     key derivation to run. That matters here specifically: this row is created by an
 *     unauthenticated endpoint built for launch traffic, and scryptSync is deliberately expensive
 *     (~100ms+), synchronous, and would block the event loop on every single demo click. A guest
 *     needs a password that can never match, not a password that is expensive to guess -- there is
 *     no plaintext to protect, because none exists.
 *  `role` is hardcoded 'user' and never derived from any first-account rule. */
export function createGuestUser(db: Db): UserRow {
  const email = `guest-${randomBytes(16).toString("hex")}@guest.invalid`;
  const createdAt = new Date().toISOString();
  // "guest-unusable" is not passwords.ts's ALGO tag and this has 2 fields rather than 6, so
  // verifyPassword() returns false immediately. Randomised anyway so the column is never a single
  // repeated constant across every guest row.
  const passwordHash = `guest-unusable$${randomBytes(32).toString("hex")}`;
  const info = db
    .prepare(
      `INSERT INTO users (email, name, created_at, password_hash, role, must_change_password, is_guest)
       VALUES (?, 'Guest', ?, ?, 'user', 0, 1)`,
    )
    .run(email, createdAt, passwordHash);
  return {
    id: Number(info.lastInsertRowid),
    email,
    name: "Guest",
    createdAt,
    passwordHash,
    role: "user",
    mustChangePassword: false,
    googleSub: null,
    isGuest: true,
  };
}

export interface ReapGuestsResult {
  /** User ids matched by the TTL predicate. Populated in dry-run mode too -- that's the point. */
  ids: number[];
  /** False when called in dry-run mode, i.e. nothing was actually deleted. */
  deleted: boolean;
}

/** Deletes demo-guest accounts idle for longer than `ttlMs`, so the SQLite file doesn't grow
 *  without bound on a small volume once the demo is public.
 *
 *  Idleness is `progress.updated_at`, which `writeProgressRow()` already maintains on every single
 *  save -- during a quiz that's every answer. So it is a genuine last-activity timestamp obtained
 *  for free, with no new column and no new write path. `COALESCE` to `users.created_at` covers a
 *  guest who signed in and never answered anything. Both must be older than the TTL, which is what
 *  makes it structurally impossible to reap someone mid-exam: a 115-minute mock writes continuously,
 *  so their `updated_at` is minutes old, not days.
 *
 *  `WHERE is_guest = 1` is the safety-critical clause. It is asserted directly by a test that sets a
 *  *real* user's timestamps far past the TTL and requires them to survive -- deleting real accounts
 *  is the only way this function can cause irreversible harm, so that's the property under test,
 *  not the happy path.
 *
 *  Deletes `password_resets` too. Guests never receive reset tokens, so it's dead weight for them
 *  today -- but `foreign_keys = ON` and `password_resets.user_id` references `users(id)`, so
 *  omitting it would make this throw the moment that assumption stopped holding. (`deleteUser()`
 *  above has exactly that gap; tracked separately.)
 *
 *  `dryRun` exists because this is the first automatic user-row DELETE in this system, against a
 *  deployment with no automated backup. One release of "here is what I would have deleted" is
 *  cheap insurance; see `SNOWPRO_GUEST_REAP` in server.ts. */
export function reapGuests(db: Db, options: { ttlMs: number; dryRun?: boolean }): ReapGuestsResult {
  const cutoff = new Date(Date.now() - options.ttlMs).toISOString();
  const rows = db
    .prepare(
      `SELECT users.id AS id
         FROM users
         LEFT JOIN progress ON progress.user_id = users.id
        WHERE users.is_guest = 1
          AND users.created_at < ?
          AND COALESCE(progress.updated_at, users.created_at) < ?`,
    )
    .all(cutoff, cutoff) as Array<{ id: number }>;
  const ids = rows.map((r) => r.id);
  if (ids.length === 0 || options.dryRun) return { ids, deleted: false };

  const run = db.transaction((victims: number[]) => {
    const del = (table: string) =>
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`);
    for (const uid of victims) {
      del("password_resets").run(uid);
      del("sessions").run(uid);
      del("progress").run(uid);
      // Re-assert is_guest here as well as in the SELECT: this is the statement that actually
      // destroys data, and it should be impossible to widen by editing the query above alone.
      db.prepare("DELETE FROM users WHERE id = ? AND is_guest = 1").run(uid);
    }
  });
  run(ids);
  return { ids, deleted: true };
}

/** Promotes a demo guest into a permanent account in place, preserving everything they did.
 *
 *  The progress row is keyed by `user_id` and is deliberately NOT touched -- no copy, no merge, no
 *  migration. That's the whole reason guests are real rows: conversion is one UPDATE.
 *
 *  Returns `null` when the email already belongs to someone (the caller reports a 409). Merging two
 *  accounts' progress is a genuinely different feature with real conflict semantics, and silently
 *  guessing at it here would be the wrong kind of helpful.
 *
 *  `AND is_guest = 1` in the UPDATE makes this unable to overwrite a real account's credentials even
 *  if a caller passed the wrong id. */
export function upgradeGuest(
  db: Db,
  userId: number,
  fields: { email: string; name: string; passwordHash: string },
): UserRow | null {
  const normalized = normalizeEmail(fields.email);
  const existing = findUserByEmail(db, normalized);
  if (existing && existing.id !== userId) return null;
  const info = db
    .prepare(
      `UPDATE users
          SET email = ?, name = ?, password_hash = ?, must_change_password = 0, is_guest = 0
        WHERE id = ? AND is_guest = 1`,
    )
    .run(normalized, fields.name, fields.passwordHash, userId);
  if (info.changes === 0) return null;
  return findUserById(db, userId) ?? null;
}

/** Admin-removing an account (issue #62) — same transaction shape as `admin-users.mjs`'s own
 *  `removeUser()` (sessions, then progress, then the user row), but as a reusable function for the
 *  new `DELETE /api/admin/users/:id` web route. Deliberately NOT shared code with the CLI script:
 *  that script's own header comment explains it's meant to work via direct DB access independent
 *  of the running app, and importing from here would break that independence. The route itself is
 *  responsible for the self-delete and last-admin guards -- this function unconditionally deletes
 *  whatever id it's given. */
export function deleteUser(db: Db, userId: number): void {
  const run = db.transaction((uid: number) => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM progress WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
  });
  run(userId);
}

export function setUserRole(db: Db, userId: number, role: UserRole): void {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

/** Promotes the accounts named by `SNOWPRO_ADMIN_EMAILS` to admin. Returns the emails promoted.
 *
 *  WHY THIS EXISTS, and why it's better than the rule it backs up: admin was granted to whichever
 *  account happened to be created first. On a LAN box that's fine -- the operator is the only
 *  person who can reach it. On a *public* deployment it is a real hole: the first stranger to sign
 *  up after a fresh deploy becomes the administrator, before the owner ever visits. Guest mode
 *  didn't create that problem, it just made it far likelier to be hit. Declaring the owner out of
 *  band removes the race entirely instead of narrowing it, and it survives a database reset, which
 *  a "first account" rule by definition cannot.
 *
 *  Deliberately grant-only, never revoke. A typo'd or momentarily-unset environment variable must
 *  mean "change nothing," not "demote every administrator" -- the failure mode of the second is
 *  locking the owner out of their own instance, which is precisely what this exists to prevent.
 *  Removing an admin stays a deliberate act via the admin page or the CLI.
 *
 *  Guests are excluded belt-and-braces. They can't hold a matching address (their emails are
 *  generated `@guest.invalid`), but this function's whole job is to hand out privilege, so it
 *  states the constraint rather than relying on one.
 *
 *  Idempotent: safe to call on every boot, and it only writes rows that aren't already admin. */
export function ensureConfiguredAdmins(db: Db, emails: string[]): string[] {
  const promoted: string[] = [];
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    const info = db
      .prepare("UPDATE users SET role = 'admin' WHERE email = ? AND is_guest = 0 AND role != 'admin'")
      .run(email);
    if (info.changes > 0) promoted.push(email);
  }
  return promoted;
}

/** Parses the comma-separated `SNOWPRO_ADMIN_EMAILS` value into normalized addresses.
 *
 *  Kept beside `ensureConfiguredAdmins()` rather than in server.ts so both the parsing and the
 *  promotion are unit-testable without an Express app or environment mutation, matching how
 *  `passwords.ts`/`oauth.ts` keep their pure logic out of the route layer. */
export function parseAdminEmails(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter((e) => e.length > 0);
}

export function countAdmins(db: Db): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number };
  return row.n;
}

/** Completes an admin-provisioned account's forced first-login password change (issue #62) --
 *  same atomic "the UPDATE itself is the guard" idiom as `setPasswordIfUnset()`: only succeeds
 *  `WHERE must_change_password = 1`, so a token/request that's already been consumed (or a normal
 *  account that was never in this state) can't be replayed. Returns whether this call won. Unlike
 *  `setPassword()`, there's no live session's other tokens to preserve here -- this only ever runs
 *  from `POST /api/session`'s pre-login state, before any session for this account has ever been
 *  issued. */
export function completeMustChangePassword(db: Db, userId: number, newPasswordHash: string): boolean {
  const info = db
    .prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ? AND must_change_password = 1",
    )
    .run(newPasswordHash, userId);
  return info.changes === 1;
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
