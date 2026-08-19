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
import {
  createSession,
  deleteSession,
  findFirstUser,
  findUserByEmail,
  findUserById,
  getProgressRow,
  migrateFlatFileProgress,
  normalizeEmail,
  openDb,
  ProgressConflictError,
  resolveSession,
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
