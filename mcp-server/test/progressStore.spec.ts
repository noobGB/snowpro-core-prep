/**
 * Tests progressStore.ts against a REAL SQLite file in a real temp directory -- session.spec.ts
 * mocks this module entirely with a single-writer in-memory fake, and its own comment says
 * retry-on-conflict is untested ("these tests have only one writer"). This file is where that
 * coverage actually lives: a stale-revision write throwing ProgressConflictError,
 * updateProgress()'s retry loop recovering from a real concurrent write landing mid-attempt, and
 * this file's owner-resolution logic (SNOWPRO_OWNER_EMAIL vs. "whichever account was created
 * first" vs. neither resolving to a real account).
 *
 * DATA_DIR/DB_FILE are computed once at import time from SNOWPRO_DATA_DIR (see progressStore.ts's
 * own top-of-file comment). A static top-level `import` would freeze on whatever directory was
 * set before any test ran, so every test instead sets the env var and re-imports the module fresh
 * via vi.resetModules() + dynamic import, inside beforeEach -- this reruns progressStore.ts's
 * module top level against that test's own isolated directory, and guarantees no test can ever
 * touch the real ./data/snowprep.sqlite.
 *
 * A second, independent connection (`seedDb`, opened directly via pipeline/src/db.js's openDb())
 * is used throughout to seed users/progress rows and to simulate a second writer landing
 * mid-attempt -- standing in for what's really either a second browser tab hitting
 * pipeline/src/server.ts's own PUT /api/progress route, or (this module's actual real-world
 * counterpart) that same route racing this stdio process, both with the same .sqlite file open at
 * once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ProgressState } from "../../app/src/lib/progress.js";
import { getProgressRow, openDb, upsertUserOnLogin, writeProgressRow, type Db } from "../../pipeline/src/db.js";

/** Same rationale as pipeline/test/db.spec.ts's sleepSync(): a write's revision is an ISO
 *  timestamp with millisecond precision, so two writes issued back-to-back in the same test can
 *  land in the same millisecond and produce the same revision string, making a real before/after
 *  distinction untestable without forcing a small real wall-clock gap. */
function sleepSync(ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    /* busy-wait */
  }
}

function defaultState(): ProgressState {
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

let tmpDir: string;
let seedDb: Db;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let store: typeof import("../src/progressStore.js");

beforeEach(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "progressstore-test-"));
  process.env.SNOWPRO_DATA_DIR = tmpDir;
  vi.resetModules();
  store = await import("../src/progressStore.js");
  seedDb = openDb(store.dbFilePath()); // second connection to the exact same file
});

afterEach(() => {
  store.__resetForTests();
  seedDb.close();
  delete process.env.SNOWPRO_DATA_DIR;
  delete process.env.SNOWPRO_OWNER_EMAIL;
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Creates the account progressStore.ts's resolveOwner() will treat as "the owner" under the
 *  default (no SNOWPRO_OWNER_EMAIL) fallback -- most tests just need *some* resolvable owner and
 *  don't care about the owner-resolution logic itself (that's its own describe block below). */
function seedOwner(email = "owner@example.com", name = "Owner") {
  return upsertUserOnLogin(seedDb, email, name);
}

describe("isolation", () => {
  it("resolves dbFilePath() inside the test's own SNOWPRO_DATA_DIR, never the real ./data", () => {
    expect(store.dbFilePath()).toBe(path.resolve(tmpDir, "snowprep.sqlite"));
  });
});

describe("owner resolution", () => {
  it("throws a clear error when no user accounts exist yet anywhere", () => {
    expect(() => store.readProgress()).toThrow(/No user accounts exist yet/);
  });

  it("falls back to whichever account was created first when SNOWPRO_OWNER_EMAIL is unset", () => {
    seedOwner("first@example.com", "First");
    upsertUserOnLogin(seedDb, "second@example.com", "Second");
    writeProgressRow(seedDb, 1, JSON.stringify({ ...defaultState(), examDate: "2026-01-01" }), "0");

    expect(store.readProgress().examDate).toBe("2026-01-01");
  });

  it("uses the SNOWPRO_OWNER_EMAIL account, not the first-created one, when it's set", () => {
    const first = seedOwner("first@example.com", "First");
    const second = upsertUserOnLogin(seedDb, "second@example.com", "Second");
    writeProgressRow(seedDb, first.id, JSON.stringify({ ...defaultState(), examDate: "2026-01-01" }), "0");
    writeProgressRow(seedDb, second.id, JSON.stringify({ ...defaultState(), examDate: "2027-01-01" }), "0");

    process.env.SNOWPRO_OWNER_EMAIL = "second@example.com";
    expect(store.readProgress().examDate).toBe("2027-01-01");
  });

  it("SNOWPRO_OWNER_EMAIL lookup is case/whitespace-insensitive, matching the web app's own login normalization", () => {
    seedOwner("owner@example.com", "Owner");
    writeProgressRow(seedDb, 1, JSON.stringify({ ...defaultState(), examDate: "2026-01-01" }), "0");

    process.env.SNOWPRO_OWNER_EMAIL = "  Owner@Example.com  ";
    expect(store.readProgress().examDate).toBe("2026-01-01");
  });

  it("throws a clear error when SNOWPRO_OWNER_EMAIL is set but no such account exists", () => {
    seedOwner("someone-else@example.com", "Someone Else");
    process.env.SNOWPRO_OWNER_EMAIL = "ghost@example.com";
    expect(() => store.readProgress()).toThrow(/no such account exists yet/);
  });
});

describe("readProgress", () => {
  it("returns defaultProgressState() when the owner has no progress row yet", () => {
    seedOwner();
    expect(store.readProgress()).toEqual(store.defaultProgressState());
  });

  it("falls back to defaultProgressState() on an unparseable progress row instead of throwing", () => {
    const owner = seedOwner();
    seedDb.prepare("INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?)").run(
      owner.id,
      "{ not valid json",
      new Date().toISOString(),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(store.readProgress()).toEqual(store.defaultProgressState());
    expect(errSpy).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });
});

describe("writeProgress -- stale revision", () => {
  it("throws ProgressConflictError when the revision changed since it was read (case 1)", () => {
    const owner = seedOwner();
    store.writeProgress(defaultState(), "0"); // first-ever write, no row existed yet
    const readRev = getProgressRow(seedDb, owner.id)!.updatedAt;

    // Simulate another writer (e.g. the web app's PUT /api/progress route) touching the row
    // after we captured readRev but before we write our own change.
    sleepSync(5);
    writeProgressRow(seedDb, owner.id, JSON.stringify({ ...defaultState(), examDate: "2099-01-01" }), readRev);

    expect(() => store.writeProgress(defaultState(), readRev)).toThrow(store.ProgressConflictError);
  });

  it("succeeds when expectedRev matches the row's current revision", () => {
    seedOwner();
    store.writeProgress(defaultState(), "0");
    const rev = getProgressRow(seedDb, 1)!.updatedAt;
    const location = { route: "/dashboard", label: "Dashboard", at: new Date().toISOString() };
    expect(() => store.writeProgress({ ...defaultState(), lastLocation: location }, rev)).not.toThrow();
    expect(store.readProgress().lastLocation).toEqual(location);
  });
});

// No "post-write read-back guard" test here, unlike the old flat-file version: that guard existed
// because a bare writeFileSync + renameSync can report success while the bytes never actually
// land (no journalling, no fsync guarantee). db.ts's writeProgressRow() commits inside a real
// SQLite transaction instead -- a commit that returns without throwing is already a much stronger
// durability guarantee than that, so a same-process read-back after it would just be re-reading
// what this same connection already knows it wrote, not a meaningful check. What SQLite genuinely
// can't guarantee on its own is safe *concurrent* access from a second process over this app's
// specific Docker-bind-mount + native-host topology -- see db.ts's openDb() doc comment for why
// that's handled by deliberately not using WAL mode, not by a read-back here.

describe("updateProgress -- retry on conflict", () => {
  it("retries and succeeds after a real concurrent write lands between read and write (case 2)", () => {
    const owner = seedOwner();
    store.writeProgress(defaultState(), "0"); // seed a row so there's a real revision to race

    const location = { route: "/dashboard", label: "Dashboard", at: new Date().toISOString() };
    let mutateCalls = 0;
    const result = store.updateProgress((state) => {
      mutateCalls++;
      if (mutateCalls === 1) {
        // Simulate a second process (e.g. the web app's own PUT handler) writing in the window
        // between updateProgress()'s currentRev()/readProgress() and its own writeProgress() call
        // -- a real seam, since `mutate` is caller-supplied code that runs in between them.
        sleepSync(5);
        const rev = getProgressRow(seedDb, owner.id)!.updatedAt;
        writeProgressRow(seedDb, owner.id, JSON.stringify({ ...state, examDate: "2030-06-01" }), rev);
      }
      return { ok: true as const, next: { ...state, lastLocation: location }, value: "done" };
    });

    expect(mutateCalls).toBe(2); // attempt 1 conflicted and retried; attempt 2 succeeded
    expect(result).toEqual({ ok: true, value: "done" });

    // Proof the retry re-read fresh state rather than reusing attempt 1's stale snapshot: the
    // final write carries both the concurrent writer's change AND this call's own change.
    const final = store.readProgress();
    expect(final.examDate).toBe("2030-06-01");
    expect(final.lastLocation).toEqual(location);
  });

  it("returns ok:false after exhausting maxAttempts under sustained conflict", () => {
    const owner = seedOwner();
    store.writeProgress(defaultState(), "0");

    let calls = 0;
    const result = store.updateProgress((state) => {
      calls++;
      // Every attempt races a fresh external write in behind it, so every writeProgress() call
      // in this test conflicts -- the retry loop never gets a clean attempt.
      sleepSync(5);
      const rev = getProgressRow(seedDb, owner.id)!.updatedAt;
      writeProgressRow(seedDb, owner.id, JSON.stringify({ ...state, examDate: `2030-0${calls}-01` }), rev);
      return { ok: true as const, next: state, value: calls };
    }, 3);

    expect(calls).toBe(3);
    expect(result.ok).toBe(false);
  });

  it("returns a business-rule rejection immediately without retrying or writing (case 4)", () => {
    const owner = seedOwner();
    store.writeProgress(defaultState(), "0");
    const revBefore = getProgressRow(seedDb, owner.id)!.updatedAt;

    let calls = 0;
    const result = store.updateProgress((_state) => {
      calls++;
      return { ok: false as const, error: "a session is already in progress" };
    });

    expect(calls).toBe(1); // a business-rule failure can't be fixed by retrying, so it isn't
    expect(result).toEqual({ ok: false, error: "a session is already in progress" });
    expect(getProgressRow(seedDb, owner.id)!.updatedAt).toBe(revBefore); // never touched the row
  });
});
