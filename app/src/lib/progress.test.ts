/**
 * Tests for progress.ts's default/load behavior around `settings.theme`, added when that field's
 * type widened from the literal "dark" to "dark" | "light" | "system" (issue #34). progress.ts
 * reads localStorage once at module import time (loadFromStorage()), so each case that needs a
 * specific stored value re-imports the module fresh via vi.resetModules() rather than mutating
 * already-imported module state.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

/** Stubs global localStorage with an in-memory Map, then dynamically re-imports progress.ts so
 *  its module-level `loadFromStorage()` call sees exactly this stored value. `window` stays
 *  undefined in this suite's node test environment, so the module's `hydrateFromServer()` boot
 *  probe never fires and there's no fetch to mock. */
async function importFreshWithStoredValue(raw: string | null) {
  vi.resetModules();
  const store = new Map<string, string>();
  if (raw !== null) store.set("snowprep.progress", raw);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  };
  return import("./progress");
}

describe("progress.ts settings.theme default/load", () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
  });

  it("defaultState() defaults settings.theme to 'dark' when nothing is stored", async () => {
    const { getProgress } = await importFreshWithStoredValue(null);
    expect(getProgress().settings.theme).toBe("dark");
  });

  it("loads an old persisted blob with settings: {theme: 'dark'} (pre-widen shape) fine", async () => {
    // A pre-widen record wouldn't have had "light"/"system" as possible values at all — "dark"
    // remains a valid member of the widened type, so the shallow merge with defaultState() should
    // pass it through unchanged rather than needing any migration.
    const oldBlob = { schemaVersion: 1, settings: { theme: "dark" } };
    const { getProgress } = await importFreshWithStoredValue(JSON.stringify(oldBlob));
    const state = getProgress();
    expect(state.settings.theme).toBe("dark");
    // Fields absent from the old blob still come from defaultState()'s shallow merge.
    expect(state.attempts).toEqual([]);
  });
});

/** Stubs `window` (truthy, so the module's own hydrateFromServer() boot probe fires and switches
 *  `backend` to "http") and a scripted `fetch`, then dynamically re-imports progress.ts. */
async function importFreshWithHttpBackend(fetchMock: typeof fetch) {
  vi.resetModules();
  const store = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { addEventListener: () => {} };
  vi.stubGlobal("fetch", fetchMock);
  const mod = await import("./progress");
  // Let the module's own fire-and-forget hydrateFromServer() call resolve before the test proceeds.
  await new Promise((r) => setTimeout(r, 0));
  return mod;
}

describe("progress.ts resetProgressConfirmed (issue #107)", () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    vi.unstubAllGlobals();
  });

  it("retries on a 409 write conflict and confirms success against the fresh revision", async () => {
    let putAttempts = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init) {
        // GET /api/progress -- both the initial hydrate and the post-409 re-sync.
        return { ok: true, headers: { get: () => "rev-1" }, json: async () => ({ schemaVersion: 1, attempts: [] }) } as unknown as Response;
      }
      putAttempts++;
      if (putAttempts === 1) {
        return { ok: false, status: 409, headers: { get: () => null } } as unknown as Response;
      }
      return { ok: true, status: 204, headers: { get: () => "rev-2" } } as unknown as Response;
    });

    const { resetProgressConfirmed, getProgress } = await importFreshWithHttpBackend(fetchMock as unknown as typeof fetch);
    const ok = await resetProgressConfirmed();

    expect(ok).toBe(true);
    expect(putAttempts).toBe(2); // first PUT hit the 409, second (after re-syncing rev) succeeded
    expect(getProgress().attempts).toEqual([]);
  });

  it("gives up and reports failure after repeated conflicts rather than retrying forever", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init) return { ok: true, headers: { get: () => "rev-1" }, json: async () => ({ schemaVersion: 1, attempts: [] }) } as unknown as Response;
      return { ok: false, status: 409, headers: { get: () => null } } as unknown as Response;
    });

    const { resetProgressConfirmed } = await importFreshWithHttpBackend(fetchMock as unknown as typeof fetch);
    const ok = await resetProgressConfirmed(3);

    expect(ok).toBe(false);
  });
});
