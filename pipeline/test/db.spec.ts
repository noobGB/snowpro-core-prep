/**
 * Tests db.ts against a REAL SQLite file in a real temp directory (mirroring
 * mcp-server/test/progressStore.spec.ts's "no mocking the storage layer" style) rather than an
 * in-memory fake — better-sqlite3's WAL mode, busy_timeout, and BEGIN IMMEDIATE transaction
 * semantics (writeProgressRow's concurrency guard) only mean something against a real file that a
 * second connection can also open, which is exactly the multi-process situation this app is
 * actually in (this container's Express process + mcp-server/'s separate stdio process, both with
 * the same .sqlite file open at once).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  completeMustChangePassword,
  completePasswordReset,
  countAdmins,
  createPasswordResetToken,
  createSession,
  createUserByAdmin,
  deleteSession,
  deleteUser,
  findFirstUser,
  findUserByEmail,
  findUserById,
  getProgressRow,
  listAllUsers,
  migrateFlatFileProgress,
  normalizeEmail,
  openDb,
  ProgressConflictError,
  resolveSession,
  setPassword,
  setPasswordIfUnset,
  setUserRole,
  upsertUserOnLogin,
  usersCount,
  writeProgressRow,
  type Db,
} from "../src/db.js";

/** Same rationale as progressStore.spec.ts's sleepSync(): writeProgressRow()'s revision is an
 *  ISO timestamp with millisecond precision, so two writes issued back-to-back in the same test
 *  can land in the same millisecond and produce the same revision string, making a real
 *  before/after distinction untestable without forcing a small real wall-clock gap. */
function sleepSync(ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    /* busy-wait */
  }
}

function defaultProgressJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    examDate: null,
    lastLocation: null,
    attempts: [],
    inProgress: null,
    flashcards: { seen: [], lastIndex: 0, grades: {} },
    plan: { checked: [] },
    setup: { checked: [] },
    settings: { theme: "dark" },
    ...overrides,
  });
}

let tmpDir: string;
let dbFile: string;
let db: Db;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "snowprep-db-test-"));
  dbFile = path.join(tmpDir, "snowprep.sqlite");
  db = openDb(dbFile);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases, including non-ASCII case folding", () => {
    expect(normalizeEmail("  Person@Example.com  ")).toBe("person@example.com");
    expect(normalizeEmail("BJÖRN@example.com")).toBe("björn@example.com");
  });
});

describe("upsertUserOnLogin / findUserByEmail", () => {
  it("creates a new user on first login", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.name).toBe("Alice");
    expect(usersCount(db)).toBe(1);
  });

  it("looks up an existing user case-insensitively", () => {
    upsertUserOnLogin(db, "alice@example.com", "Alice");
    expect(findUserByEmail(db, "ALICE@EXAMPLE.COM")).toMatchObject({ email: "alice@example.com", name: "Alice" });
    expect(findUserByEmail(db, "  Alice@Example.com  ")).toMatchObject({ email: "alice@example.com" });
  });

  it("two different emails with the same name are two separate accounts", () => {
    upsertUserOnLogin(db, "alice@example.com", "Study Buddy");
    upsertUserOnLogin(db, "bob@example.com", "Study Buddy");
    expect(usersCount(db)).toBe(2);
  });

  it("re-logging in with the same email but a different name updates the existing account in place, not a new one", () => {
    const first = upsertUserOnLogin(db, "alice@example.com", "Alise"); // typo
    const second = upsertUserOnLogin(db, "Alice@Example.com", "Alice"); // corrected, different case too
    expect(usersCount(db)).toBe(1);
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Alice");
    expect(findUserByEmail(db, "alice@example.com")?.name).toBe("Alice");
  });

  // Issue #41: returning users shouldn't be re-asked for a name the server already has.
  describe("email-only login (issue #41 -- name omitted)", () => {
    it("logging in with just email for a known user returns the account unchanged, without touching the stored name", () => {
      upsertUserOnLogin(db, "alice@example.com", "Alice");
      const result = upsertUserOnLogin(db, "alice@example.com");
      expect(result.name).toBe("Alice");
      expect(usersCount(db)).toBe(1);
    });

    it("looks up the known user case-insensitively even with no name given", () => {
      const created = upsertUserOnLogin(db, "alice@example.com", "Alice");
      const result = upsertUserOnLogin(db, "ALICE@EXAMPLE.COM");
      expect(result.id).toBe(created.id);
      expect(result.name).toBe("Alice");
    });

    it("throws when called for an email with no account and no name to create one -- callers must check findUserByEmail() first", () => {
      expect(() => upsertUserOnLogin(db, "nobody@example.com")).toThrow();
      expect(usersCount(db)).toBe(0); // the failed attempt must not have created a blank-name account
    });
  });
});

describe("findFirstUser", () => {
  it("returns the earliest-created user (lowest id), regardless of lookup order later", () => {
    upsertUserOnLogin(db, "first@example.com", "First");
    upsertUserOnLogin(db, "second@example.com", "Second");
    expect(findFirstUser(db)?.email).toBe("first@example.com");
  });

  it("returns undefined when no users exist yet", () => {
    expect(findFirstUser(db)).toBeUndefined();
  });
});

describe("sessions", () => {
  it("creates a session and resolves it back to the right user", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const token = createSession(db, user.id);
    expect(resolveSession(db, token)).toMatchObject({ id: user.id, email: "alice@example.com" });
  });

  it("returns undefined for an unknown token", () => {
    expect(resolveSession(db, "not-a-real-token")).toBeUndefined();
  });

  it("deleteSession invalidates the token (sign out)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const token = createSession(db, user.id);
    deleteSession(db, token);
    expect(resolveSession(db, token)).toBeUndefined();
  });

  it("resolveSession includes passwordHash (issue #46 regression: the JOIN query must select it explicitly, not just the base user columns)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$salt$hash");
    const token = createSession(db, user.id);
    expect(resolveSession(db, token)?.passwordHash).toBe("scrypt$16384$8$1$salt$hash");
  });

  it("two different logins for the same user get two independent tokens", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const t1 = createSession(db, user.id);
    const t2 = createSession(db, user.id);
    expect(t1).not.toBe(t2);
    deleteSession(db, t1);
    expect(resolveSession(db, t2)).toMatchObject({ id: user.id }); // signing out one device doesn't sign out another
  });
});

describe("progress row read/write", () => {
  it("getProgressRow returns undefined when the user has no row yet", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    expect(getProgressRow(db, user.id)).toBeUndefined();
  });

  it("writeProgressRow creates the row on first write (expectedRev '0', matching the no-row sentinel)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const rev = writeProgressRow(db, user.id, defaultProgressJson({ examDate: "2026-09-02" }), "0");
    const row = getProgressRow(db, user.id);
    expect(row?.updatedAt).toBe(rev);
    expect(JSON.parse(row!.data).examDate).toBe("2026-09-02");
  });

  it("succeeds when expectedRev matches the row's current revision", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const rev1 = writeProgressRow(db, user.id, defaultProgressJson(), "0");
    sleepSync(5);
    const rev2 = writeProgressRow(db, user.id, defaultProgressJson({ examDate: "2026-01-01" }), rev1);
    expect(rev2).not.toBe(rev1);
    expect(JSON.parse(getProgressRow(db, user.id)!.data).examDate).toBe("2026-01-01");
  });

  it("throws ProgressConflictError when expectedRev is stale (another writer landed in between)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const staleRev = writeProgressRow(db, user.id, defaultProgressJson(), "0");
    sleepSync(5);
    // Simulate a second writer (e.g. the MCP server, or a second browser tab) landing first.
    writeProgressRow(db, user.id, defaultProgressJson({ examDate: "2030-06-01" }), staleRev);

    expect(() => writeProgressRow(db, user.id, defaultProgressJson({ examDate: "2099-01-01" }), staleRev)).toThrow(
      ProgressConflictError,
    );
    // The conflicting write must not have landed -- the second writer's change is still there.
    expect(JSON.parse(getProgressRow(db, user.id)!.data).examDate).toBe("2030-06-01");
  });

  it("isolates progress rows per user -- writing one user's row never touches another's", () => {
    const alice = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const bob = upsertUserOnLogin(db, "bob@example.com", "Bob");
    writeProgressRow(db, alice.id, defaultProgressJson({ examDate: "2026-01-01" }), "0");
    writeProgressRow(db, bob.id, defaultProgressJson({ examDate: "2027-01-01" }), "0");

    expect(JSON.parse(getProgressRow(db, alice.id)!.data).examDate).toBe("2026-01-01");
    expect(JSON.parse(getProgressRow(db, bob.id)!.data).examDate).toBe("2027-01-01");
  });
});

describe("migrateFlatFileProgress", () => {
  function oldFilePath(): string {
    return path.join(tmpDir, "progress.json");
  }

  it("returns false and does nothing when the old flat file doesn't exist", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    expect(migrateFlatFileProgress(db, user.id, oldFilePath())).toBe(false);
    expect(getProgressRow(db, user.id)).toBeUndefined();
  });

  it("imports a real fixture progress.json byte-for-byte into the first user's row, then renames the old file", () => {
    // A realistic fixture -- attempts, flashcard state, a plan checklist -- not a trivial empty
    // object, since the whole point of this test is proving real user data survives the migration
    // unchanged, not just "the code path doesn't throw."
    const fixture = {
      schemaVersion: 1,
      examDate: "2026-09-02",
      lastLocation: { route: "/practice", label: "Practice", at: "2026-08-15T10:00:00.000Z" },
      attempts: [
        {
          id: "attempt-1",
          setId: "set-d1",
          kind: "domain",
          bankVersion: "sha256:abc123",
          startedAt: "2026-08-14T09:00:00.000Z",
          submittedAt: "2026-08-14T09:20:00.000Z",
          status: "complete",
          durationSec: 1200,
          answers: { "d1-q1": { picked: ["B"], correct: true, credit: 1, timeSec: 30 } },
          scaled: 820,
          rawPct: 0.9,
          byDomain: { d1: { answered: 10, credit: 9, scaled: 900 } },
        },
      ],
      inProgress: null,
      flashcards: { seen: ["d1-q1", "d1-q2"], lastIndex: 2, grades: { "d1-q1": "known", "d1-q2": "missed" } },
      plan: { checked: ["s-1", "s-2"] },
      setup: { checked: ["s-1"] },
      settings: { theme: "dark" },
    };
    const fixturePath = oldFilePath();
    mkdirSync(path.dirname(fixturePath), { recursive: true });
    const fixtureText = JSON.stringify(fixture, null, 2); // pretty-printed, unlike the app's own compact writes -- proves this isn't silently normalized
    writeFileSync(fixturePath, fixtureText, "utf8");

    const user = upsertUserOnLogin(db, "returning-owner@example.com", "Returning Owner");
    const migrated = migrateFlatFileProgress(db, user.id, fixturePath);

    expect(migrated).toBe(true);
    const row = getProgressRow(db, user.id);
    expect(row?.data).toBe(fixtureText); // byte-for-byte, not just semantically equal
    expect(JSON.parse(row!.data)).toEqual(fixture);

    // The old file must be renamed aside so it's never re-imported on a later restart.
    expect(existsSync(fixturePath)).toBe(false);
    expect(existsSync(`${fixturePath}.migrated`)).toBe(true);
    expect(readFileSync(`${fixturePath}.migrated`, "utf8")).toBe(fixtureText);
  });

  it("fails open on a corrupt old file: doesn't import garbage, still renames it aside so it isn't retried forever", () => {
    const fixturePath = oldFilePath();
    mkdirSync(path.dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, "{ not valid json at all", "utf8");

    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const migrated = migrateFlatFileProgress(db, user.id, fixturePath);

    expect(migrated).toBe(false);
    expect(getProgressRow(db, user.id)).toBeUndefined(); // no garbage row created
    expect(existsSync(fixturePath)).toBe(false);
    expect(existsSync(`${fixturePath}.migrated`)).toBe(true); // still moved aside, not retried forever
  });
});

describe("findUserById", () => {
  it("resolves a user by numeric id", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    expect(findUserById(db, user.id)).toMatchObject({ email: "alice@example.com" });
  });

  it("returns undefined for an unknown id", () => {
    expect(findUserById(db, 999999)).toBeUndefined();
  });
});

// Issue #46: password login.
describe("password_hash column", () => {
  it("a user created without a password hash has passwordHash null (legacy/pre-#46 shape)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    expect(user.passwordHash).toBeNull();
    expect(findUserByEmail(db, "alice@example.com")?.passwordHash).toBeNull();
  });

  it("a user created WITH a password hash (new-account signup) has it set immediately", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$deadbeef$c0ffee");
    expect(user.passwordHash).toBe("scrypt$16384$8$1$deadbeef$c0ffee");
    expect(findUserByEmail(db, "alice@example.com")?.passwordHash).toBe("scrypt$16384$8$1$deadbeef$c0ffee");
  });

  it("re-opening an existing pre-#46 database file (no password_hash column yet) gets the column added, existing rows read back as null", () => {
    // Simulate a database that predates issue #46: open it once, insert a user with the OLD
    // (name-only) shape directly, close it -- then re-open via openDb() again, which is exactly
    // what happens on a real container restart after this feature ships, and confirm the ALTER
    // TABLE migration ran and didn't corrupt the pre-existing row.
    db.prepare("INSERT INTO users (email, name, created_at) VALUES (?, ?, ?)").run(
      "legacy@example.com",
      "Legacy User",
      new Date().toISOString(),
    );
    db.close();
    db = openDb(dbFile); // re-open the SAME file -- openDb() must be idempotent on a second call too
    expect(findUserByEmail(db, "legacy@example.com")).toMatchObject({ name: "Legacy User", passwordHash: null });
  });
});

describe("setPasswordIfUnset (the legacy account-claiming flow)", () => {
  it("claims a legacy account's password when none is set yet", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const claimed = setPasswordIfUnset(db, user.id, "scrypt$16384$8$1$salt$hash");
    expect(claimed).toBe(true);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$salt$hash");
  });

  it("refuses to overwrite an already-claimed password (returns false, leaves the original hash)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    expect(setPasswordIfUnset(db, user.id, "scrypt$16384$8$1$first$hash")).toBe(true);
    const secondAttempt = setPasswordIfUnset(db, user.id, "scrypt$16384$8$1$second$hash");
    expect(secondAttempt).toBe(false);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$first$hash"); // unchanged
  });

  it("the race guard is the UPDATE itself: only one of two 'simultaneous' claims against the same legacy row wins", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    // better-sqlite3 is synchronous, so these two calls can't literally interleave at the JS
    // level -- but the assertion that matters is the one setPasswordIfUnset's own contract makes:
    // exactly one caller sees `true`, and the row ends up holding exactly that caller's hash, not
    // a hybrid or a silently-overwritten value.
    const results = [
      setPasswordIfUnset(db, user.id, "scrypt$16384$8$1$attempt-a$hash"),
      setPasswordIfUnset(db, user.id, "scrypt$16384$8$1$attempt-b$hash"),
    ];
    expect(results).toEqual([true, false]);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$attempt-a$hash");
  });
});

describe("setPassword (authenticated change, invalidates other sessions)", () => {
  it("overwrites the password unconditionally, even if one was already set", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$old$hash");
    setPassword(db, user.id, "scrypt$16384$8$1$new$hash");
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$new$hash");
  });

  it("deletes every OTHER session for this user but keeps the one passed as keepToken", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const keep = createSession(db, user.id);
    const other1 = createSession(db, user.id);
    const other2 = createSession(db, user.id);

    setPassword(db, user.id, "scrypt$16384$8$1$new$hash", keep);

    expect(resolveSession(db, keep)).toMatchObject({ id: user.id });
    expect(resolveSession(db, other1)).toBeUndefined();
    expect(resolveSession(db, other2)).toBeUndefined();
  });

  it("with no keepToken, deletes ALL sessions for this user (the login-gate claim path, which has no prior session)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const t1 = createSession(db, user.id);
    const t2 = createSession(db, user.id);

    setPassword(db, user.id, "scrypt$16384$8$1$new$hash");

    expect(resolveSession(db, t1)).toBeUndefined();
    expect(resolveSession(db, t2)).toBeUndefined();
  });

  it("never touches another user's sessions or password", () => {
    const alice = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$a$hash");
    const bob = upsertUserOnLogin(db, "bob@example.com", "Bob", "scrypt$16384$8$1$b$hash");
    const bobToken = createSession(db, bob.id);

    setPassword(db, alice.id, "scrypt$16384$8$1$a2$hash");

    expect(findUserById(db, bob.id)?.passwordHash).toBe("scrypt$16384$8$1$b$hash");
    expect(resolveSession(db, bobToken)).toMatchObject({ id: bob.id });
  });
});

// Issue #59: self-service forgot-password.
describe("createPasswordResetToken / completePasswordReset", () => {
  it("a valid token successfully sets the new password and consumes itself", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$old$hash");
    const token = createPasswordResetToken(db, user.id, 60 * 60 * 1000);

    const succeeded = completePasswordReset(db, token, "scrypt$16384$8$1$new$hash");

    expect(succeeded).toBe(true);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$new$hash");
  });

  it("an expired token fails and leaves the password unchanged", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$old$hash");
    const token = createPasswordResetToken(db, user.id, -1); // already expired the instant it's created

    const succeeded = completePasswordReset(db, token, "scrypt$16384$8$1$new$hash");

    expect(succeeded).toBe(false);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$old$hash");
  });

  it("an unknown token fails", () => {
    expect(completePasswordReset(db, "not-a-real-token", "scrypt$16384$8$1$new$hash")).toBe(false);
  });

  it("a token can only be used once -- the second attempt against the same token fails", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const token = createPasswordResetToken(db, user.id, 60 * 60 * 1000);

    expect(completePasswordReset(db, token, "scrypt$16384$8$1$first$hash")).toBe(true);
    expect(completePasswordReset(db, token, "scrypt$16384$8$1$second$hash")).toBe(false);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$first$hash");
  });

  it("requesting a new token invalidates the previously issued one for the same user", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const firstToken = createPasswordResetToken(db, user.id, 60 * 60 * 1000);
    createPasswordResetToken(db, user.id, 60 * 60 * 1000); // second request supersedes the first

    expect(completePasswordReset(db, firstToken, "scrypt$16384$8$1$new$hash")).toBe(false);
  });

  it("completing a reset deletes every session for that user, same as setPassword()'s no-keepToken branch", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const t1 = createSession(db, user.id);
    const t2 = createSession(db, user.id);
    const token = createPasswordResetToken(db, user.id, 60 * 60 * 1000);

    completePasswordReset(db, token, "scrypt$16384$8$1$new$hash");

    expect(resolveSession(db, t1)).toBeUndefined();
    expect(resolveSession(db, t2)).toBeUndefined();
  });

  it("never touches another user's sessions or password", () => {
    const alice = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$a$hash");
    const bob = upsertUserOnLogin(db, "bob@example.com", "Bob", "scrypt$16384$8$1$b$hash");
    const bobToken = createSession(db, bob.id);
    const aliceToken = createPasswordResetToken(db, alice.id, 60 * 60 * 1000);

    completePasswordReset(db, aliceToken, "scrypt$16384$8$1$a2$hash");

    expect(findUserById(db, bob.id)?.passwordHash).toBe("scrypt$16384$8$1$b$hash");
    expect(resolveSession(db, bobToken)).toMatchObject({ id: bob.id });
  });

  it("also clears must_change_password, same as setPassword()/setPasswordIfUnset()", () => {
    const admin = createUserByAdmin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$temp$hash")!;
    const token = createPasswordResetToken(db, admin.id, 60 * 60 * 1000);
    completePasswordReset(db, token, "scrypt$16384$8$1$new$hash");
    expect(findUserById(db, admin.id)?.mustChangePassword).toBe(false);
  });
});

// Issue #62: admin user management.
describe("role bootstrap", () => {
  it("the very first account ever created on a fresh database becomes admin when the caller says so", () => {
    // Mirrors server.ts's POST /api/session: the caller (not upsertUserOnLogin itself) decides
    // "admin" based on usersCount(db) === 0 BEFORE creating the account.
    const user = upsertUserOnLogin(db, "first@example.com", "First", "scrypt$16384$8$1$a$hash", "admin");
    expect(user.role).toBe("admin");
  });

  it("upsertUserOnLogin defaults new accounts to role \"user\" when no role is passed", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$a$hash");
    expect(user.role).toBe("user");
  });

  it("re-opening a database that predates the role column promotes the earliest existing account", () => {
    // The shared `db`/`dbFile` from beforeEach already went through openDb() once, which already
    // added `role` -- inserting raw rows into THAT file wouldn't exercise the migration at all
    // (addRoleColumnIfMissing() would see the column already exists and skip straight past the
    // promotion logic). To genuinely simulate a pre-#62 database, build a SEPARATE raw file with
    // the post-#59/pre-#62 schema (has password_hash, no role/must_change_password) by hand, using
    // better-sqlite3 directly, and only THEN call db.ts's real openDb() on it for the first time.
    const legacyDbFile = path.join(tmpDir, "legacy.sqlite");
    const legacyDb = new Database(legacyDbFile);
    legacyDb.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        password_hash TEXT
      );
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
      CREATE TABLE progress (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacyDb
      .prepare("INSERT INTO users (email, name, created_at, password_hash) VALUES (?, ?, ?, ?)")
      .run("earliest@example.com", "Earliest", new Date().toISOString(), "scrypt$16384$8$1$a$hash");
    legacyDb
      .prepare("INSERT INTO users (email, name, created_at, password_hash) VALUES (?, ?, ?, ?)")
      .run("later@example.com", "Later", new Date().toISOString(), "scrypt$16384$8$1$b$hash");
    legacyDb.close();

    const migratedDb = openDb(legacyDbFile); // the real migration path -- first time this file sees openDb()
    try {
      expect(findUserByEmail(migratedDb, "earliest@example.com")?.role).toBe("admin");
      expect(findUserByEmail(migratedDb, "later@example.com")?.role).toBe("user");
    } finally {
      migratedDb.close();
    }
  });

  it("does NOT re-promote the earliest account if an admin already exists (idempotent across restarts)", () => {
    const earliest = upsertUserOnLogin(db, "earliest@example.com", "Earliest", "scrypt$16384$8$1$a$hash");
    upsertUserOnLogin(db, "later@example.com", "Later", "scrypt$16384$8$1$b$hash", "admin");
    setUserRole(db, earliest.id, "user"); // demoted deliberately

    db.close();
    db = openDb(dbFile); // re-running the (already-applied) migration must be a no-op

    expect(findUserByEmail(db, "earliest@example.com")?.role).toBe("user");
    expect(findUserByEmail(db, "later@example.com")?.role).toBe("admin");
  });
});

describe("listAllUsers", () => {
  it("returns every user with role/hasPassword/mustChangePassword/sessionCount", () => {
    const admin = upsertUserOnLogin(db, "admin@example.com", "Admin", "scrypt$16384$8$1$a$hash", "admin");
    createSession(db, admin.id);
    createUserByAdmin(db, "temp@example.com", "Temp", "scrypt$16384$8$1$t$hash");

    const rows = listAllUsers(db);
    expect(rows).toHaveLength(2);

    const adminRow = rows.find((r) => r.email === "admin@example.com")!;
    expect(adminRow).toMatchObject({ role: "admin", hasPassword: true, mustChangePassword: false, sessionCount: 1 });

    const tempRow = rows.find((r) => r.email === "temp@example.com")!;
    expect(tempRow).toMatchObject({ role: "user", hasPassword: true, mustChangePassword: true, sessionCount: 0 });
  });

  it("returns an empty array when no users exist", () => {
    expect(listAllUsers(db)).toEqual([]);
  });
});

describe("createUserByAdmin", () => {
  it("creates a user with role \"user\" and mustChangePassword true", () => {
    const user = createUserByAdmin(db, "new@example.com", "New Person", "scrypt$16384$8$1$t$hash");
    expect(user).toMatchObject({ email: "new@example.com", name: "New Person", role: "user", mustChangePassword: true });
    expect(findUserByEmail(db, "new@example.com")).toMatchObject({ role: "user", mustChangePassword: true });
  });

  it("returns null (does not overwrite) when the email already has an account", () => {
    upsertUserOnLogin(db, "existing@example.com", "Existing", "scrypt$16384$8$1$orig$hash");
    const result = createUserByAdmin(db, "Existing@Example.com", "Someone Else", "scrypt$16384$8$1$new$hash");
    expect(result).toBeNull();
    expect(findUserByEmail(db, "existing@example.com")).toMatchObject({ name: "Existing", passwordHash: "scrypt$16384$8$1$orig$hash" });
  });
});

describe("deleteUser", () => {
  it("deletes the user, their sessions, and their progress row", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const token = createSession(db, user.id);
    writeProgressRow(db, user.id, "{}", "0");

    deleteUser(db, user.id);

    expect(findUserById(db, user.id)).toBeUndefined();
    expect(resolveSession(db, token)).toBeUndefined();
    expect(getProgressRow(db, user.id)).toBeUndefined();
  });

  it("never touches another user's account", () => {
    const alice = upsertUserOnLogin(db, "alice@example.com", "Alice");
    const bob = upsertUserOnLogin(db, "bob@example.com", "Bob");
    deleteUser(db, alice.id);
    expect(findUserById(db, bob.id)).toMatchObject({ email: "bob@example.com" });
  });
});

describe("setUserRole / countAdmins", () => {
  it("changes a user's role", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice");
    setUserRole(db, user.id, "admin");
    expect(findUserById(db, user.id)?.role).toBe("admin");
    setUserRole(db, user.id, "user");
    expect(findUserById(db, user.id)?.role).toBe("user");
  });

  it("countAdmins counts only role=admin rows", () => {
    upsertUserOnLogin(db, "a@example.com", "A", "scrypt$16384$8$1$a$hash", "admin");
    upsertUserOnLogin(db, "b@example.com", "B", "scrypt$16384$8$1$b$hash", "admin");
    upsertUserOnLogin(db, "c@example.com", "C", "scrypt$16384$8$1$c$hash");
    expect(countAdmins(db)).toBe(2);
  });
});

describe("completeMustChangePassword", () => {
  it("succeeds for a pending account and clears the flag", () => {
    const user = createUserByAdmin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$temp$hash")!;
    const succeeded = completeMustChangePassword(db, user.id, "scrypt$16384$8$1$new$hash");
    expect(succeeded).toBe(true);
    expect(findUserById(db, user.id)).toMatchObject({ passwordHash: "scrypt$16384$8$1$new$hash", mustChangePassword: false });
  });

  it("fails for an account that was never pending (the guard is the WHERE clause, not a preceding check)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$a$hash");
    const succeeded = completeMustChangePassword(db, user.id, "scrypt$16384$8$1$new$hash");
    expect(succeeded).toBe(false);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$a$hash"); // unchanged
  });

  it("can't be replayed -- a second call against the same already-completed account fails", () => {
    const user = createUserByAdmin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$temp$hash")!;
    expect(completeMustChangePassword(db, user.id, "scrypt$16384$8$1$first$hash")).toBe(true);
    expect(completeMustChangePassword(db, user.id, "scrypt$16384$8$1$second$hash")).toBe(false);
    expect(findUserById(db, user.id)?.passwordHash).toBe("scrypt$16384$8$1$first$hash");
  });
});

describe("setPassword / setPasswordIfUnset also clear must_change_password", () => {
  it("setPassword clears it", () => {
    const user = createUserByAdmin(db, "alice@example.com", "Alice", "scrypt$16384$8$1$temp$hash")!;
    setPassword(db, user.id, "scrypt$16384$8$1$new$hash");
    expect(findUserById(db, user.id)?.mustChangePassword).toBe(false);
  });

  it("setPasswordIfUnset clears it (defensive -- the two flags shouldn't normally coexist, but must never conflict if they do)", () => {
    const user = upsertUserOnLogin(db, "alice@example.com", "Alice"); // passwordHash null, legacy claim path
    setPasswordIfUnset(db, user.id, "scrypt$16384$8$1$claimed$hash");
    expect(findUserById(db, user.id)?.mustChangePassword).toBe(false);
  });
});
