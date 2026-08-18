/**
 * Tests progressStore.ts against a REAL temp directory on disk -- session.spec.ts mocks this
 * module entirely with a single-writer in-memory fake and its own comment says retry-on-conflict
 * is untested ("these tests have only one writer"). This file is where that coverage actually
 * lives: a stale-mtime write throwing ProgressConflictError, updateProgress()'s retry loop
 * recovering from a real concurrent write landing mid-attempt, and the post-write read-back guard.
 *
 * DATA_DIR/PROGRESS_FILE are computed once at import time from SNOWPRO_DATA_DIR (see
 * progressStore.ts's own top-of-file comment and its `DATA_DIR` constant). A static top-level
 * `import` would freeze on whatever directory was set before any test ran, so every test instead
 * sets the env var and re-imports the module fresh via vi.resetModules() + dynamic import, inside
 * beforeEach -- this reruns progressStore.ts's module top level against that test's own isolated
 * directory, and guarantees no test can ever touch the real ./data/progress.json.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ProgressState } from "../../app/src/lib/progress.js";

// Only the "post-write read-back mismatch" test needs this -- see its own comment for why a real
// concurrent write can't legitimately reach that branch, unlike the other conflict tests below.
// Declared here (module scope) because vi.mock is hoisted above all imports in this file, so the
// factory can't close over a `let` declared after it -- this flag is the only way a single test
// can opt in without affecting every other test's real fs behavior.
let corruptNextTmpWrite = false;

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (file: unknown, data: unknown, ...rest: unknown[]) => {
      if (corruptNextTmpWrite && typeof file === "string" && file.includes(".tmp-")) {
        corruptNextTmpWrite = false;
        return (actual.writeFileSync as (...a: unknown[]) => unknown)(file, `${String(data)}-corrupted`, ...rest);
      }
      return (actual.writeFileSync as (...a: unknown[]) => unknown)(file, data, ...rest);
    },
  };
});

/** Synchronous sleep -- needed because updateProgress()'s retry loop and writeProgress()'s mtime
 *  check are both fully synchronous, so a test simulating a concurrent external write has to block
 *  real wall-clock time, not just await a microtask. mtimeMs resolution on Windows/NTFS is coarse
 *  enough in practice that two writes issued back-to-back can land in the same bucket and look
 *  unchanged to currentMtimeMs() -- 30ms is comfortably past that to keep these tests non-flaky. */
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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let store: typeof import("../src/progressStore.js");

beforeEach(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "progressstore-test-"));
  process.env.SNOWPRO_DATA_DIR = tmpDir;
  vi.resetModules();
  store = await import("../src/progressStore.js");
});

afterEach(() => {
  delete process.env.SNOWPRO_DATA_DIR;
  rmSync(tmpDir, { recursive: true, force: true });
  corruptNextTmpWrite = false;
});

describe("isolation", () => {
  it("resolves progressFilePath() inside the test's own SNOWPRO_DATA_DIR, never the real ./data", () => {
    expect(store.progressFilePath()).toBe(path.resolve(tmpDir, "progress.json"));
  });
});

describe("readProgress", () => {
  it("returns defaultProgressState() when the file doesn't exist yet", () => {
    expect(store.readProgress()).toEqual(store.defaultProgressState());
  });

  it("falls back to defaultProgressState() on unparseable JSON instead of throwing", () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(store.progressFilePath(), "{ not valid json", "utf8");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(store.readProgress()).toEqual(store.defaultProgressState());
    expect(errSpy).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });
});

describe("writeProgress -- stale mtime", () => {
  it("throws ProgressConflictError when the file's mtime changed since it was read (case 1)", () => {
    store.writeProgress(defaultState(), null); // first-ever write, file didn't exist yet
    const readMtime = statSync(store.progressFilePath()).mtimeMs;

    // Simulate another writer (e.g. the web app's PUT /api/progress route) touching the file
    // after we captured readMtime but before we write our own change.
    sleepSync(30);
    writeFileSync(store.progressFilePath(), JSON.stringify({ ...defaultState(), examDate: "2099-01-01" }), "utf8");

    expect(() => store.writeProgress(defaultState(), readMtime)).toThrow(store.ProgressConflictError);
  });

  it("succeeds when expectedMtimeMs matches the file's current mtime", () => {
    store.writeProgress(defaultState(), null);
    const mtime = statSync(store.progressFilePath()).mtimeMs;
    const location = { route: "/dashboard", label: "Dashboard", at: new Date().toISOString() };
    expect(() => store.writeProgress({ ...defaultState(), lastLocation: location }, mtime)).not.toThrow();
    expect(JSON.parse(readFileSync(store.progressFilePath(), "utf8")).lastLocation).toEqual(location);
  });
});

describe("writeProgress -- post-write read-back guard", () => {
  it("throws when the read-back doesn't match what was written (case 3)", () => {
    // There's no async seam inside writeProgress() between renameSync and the read-back
    // readFileSync() -- they're two consecutive synchronous fs calls in the same function body,
    // so nothing (not even another statement in this same test) can legitimately run in between
    // them the way case 2 below exploits a real seam inside updateProgress()'s retry loop. The
    // only way to land a real second write in that exact window would be an OS-level race (e.g.
    // swapping a symlink mid-syscall), which is inherently nondeterministic and not portable to
    // Windows -- not a reliable basis for a test. So this is the one deliberate exception to
    // "no fs mocking" in this file: `writeFileSync` is intercepted (see vi.mock at top) to corrupt
    // only the tmp file's bytes at the moment they're written. renameSync and the read-back
    // comparison both still run for real against a real file; only the root cause (a write that
    // silently didn't take, e.g. a disk-level fault) is simulated instead of the comparison itself.
    corruptNextTmpWrite = true;
    expect(() => store.writeProgress(defaultState(), null)).toThrow(/read-back doesn't match what was written/);
  });
});

describe("updateProgress -- retry on conflict", () => {
  it("retries and succeeds after a real concurrent write lands between read and write (case 2)", () => {
    store.writeProgress(defaultState(), null); // seed the file so there's a real mtime to race

    const location = { route: "/dashboard", label: "Dashboard", at: new Date().toISOString() };
    let mutateCalls = 0;
    const result = store.updateProgress((state) => {
      mutateCalls++;
      if (mutateCalls === 1) {
        // Simulate a second process (e.g. the web app's own PUT handler) writing in the window
        // between updateProgress()'s currentMtimeMs()/readProgress() and its own writeProgress()
        // call -- a real seam, since `mutate` is caller-supplied code that runs in between them.
        sleepSync(30);
        writeFileSync(store.progressFilePath(), JSON.stringify({ ...state, examDate: "2030-06-01" }), "utf8");
      }
      return { ok: true as const, next: { ...state, lastLocation: location }, value: "done" };
    });

    expect(mutateCalls).toBe(2); // attempt 1 conflicted and retried; attempt 2 succeeded
    expect(result).toEqual({ ok: true, value: "done" });

    // Proof the retry re-read fresh state rather than reusing attempt 1's stale snapshot: the
    // final write carries both the concurrent writer's change AND this call's own change.
    const onDisk = JSON.parse(readFileSync(store.progressFilePath(), "utf8"));
    expect(onDisk.examDate).toBe("2030-06-01");
    expect(onDisk.lastLocation).toEqual(location);
  });

  it("returns ok:false after exhausting maxAttempts under sustained conflict", () => {
    store.writeProgress(defaultState(), null);

    let calls = 0;
    const result = store.updateProgress((state) => {
      calls++;
      // Every attempt races a fresh external write in behind it, so every writeProgress() call
      // in this test conflicts -- the retry loop never gets a clean attempt.
      sleepSync(20);
      writeFileSync(store.progressFilePath(), JSON.stringify({ ...state, examDate: `2030-0${calls}-01` }), "utf8");
      return { ok: true as const, next: state, value: calls };
    }, 3);

    expect(calls).toBe(3);
    expect(result.ok).toBe(false);
  });

  it("returns a business-rule rejection immediately without retrying or writing (case 4)", () => {
    store.writeProgress(defaultState(), null);
    const mtimeBefore = statSync(store.progressFilePath()).mtimeMs;

    let calls = 0;
    const result = store.updateProgress((_state) => {
      calls++;
      return { ok: false as const, error: "a session is already in progress" };
    });

    expect(calls).toBe(1); // a business-rule failure can't be fixed by retrying, so it isn't
    expect(result).toEqual({ ok: false, error: "a session is already in progress" });
    expect(statSync(store.progressFilePath()).mtimeMs).toBe(mtimeBefore); // never touched the file
  });
});
