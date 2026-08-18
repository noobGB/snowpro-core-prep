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
