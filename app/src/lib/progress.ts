/**
 * Progress storage adapter, per spec §4's Progress schema. Backed by the container's two-route
 * HTTP adapter (GET/PUT /api/progress, itself backed by the mounted /data volume — see
 * pipeline/src/server.ts) when one is available, falling back to localStorage otherwise (e.g.
 * `vite dev`, or the built files opened directly without the container) — see
 * `hydrateFromServer()`/`persist()` below for the switch. Every caller in the app goes through
 * `useProgress()`/`updateProgress()`, never `localStorage` or `fetch` directly, which is exactly
 * what let this backend swap happen without touching a single call site.
 *
 * `inProgress` is an additive field beyond the spec's literal example: the schema shows
 * `attempts[]` holding only finalized records, but "answer state is written to storage on every
 * change so a crash costs nothing" implies an in-flight attempt needs *some* persisted home
 * before it's finalized. One slot (not keyed by set) is enough for now since only one session
 * can be active at a time.
 */

import { useSyncExternalStore } from "react";

export interface AttemptAnswer {
  picked: string[];
  correct: boolean;
  credit: number;
  timeSec: number;
}

export type AttemptStatus = "complete" | "partial" | "expired";

export interface Attempt {
  id: string;
  setId: string;
  kind: "domain" | "mock";
  bankVersion: string;
  startedAt: string;
  submittedAt: string;
  status: AttemptStatus;
  durationSec: number;
  answers: Record<string, AttemptAnswer>;
  scaled: number;
  rawPct: number;
  byDomain: Record<string, { answered: number; credit: number; scaled: number }>;
}

export interface InProgressAttempt {
  id: string;
  setId: string;
  kind: "domain" | "mock";
  bankVersion: string;
  startedAt: string;
  answers: Record<string, { picked: string[]; timeSec: number }>;
}

export interface ProgressState {
  schemaVersion: 1;
  examDate: string | null;
  lastLocation: { route: string; label: string; at: string } | null;
  attempts: Attempt[];
  inProgress: InProgressAttempt | null;
  /** `grades` is read defensively (`?? {}`) at every call site — `loadFromStorage()`'s merge is
   *  shallow, so progress saved before this field existed has a `flashcards` object present but
   *  missing `grades`, not a `flashcards` object absent entirely. Same caveat applies to any future
   *  field added under `plan`/`setup`/`settings`. */
  flashcards: { seen: string[]; lastIndex: number; grades: Record<string, "known" | "missed"> };
  plan: {
    checked: string[];
    /** Issue #76: whether the one-time crunch-mode explainer card has been dismissed. Optional
     *  (not just defensively-read) rather than added to every `defaultProgressState()` copy across
     *  packages (app/pipeline/mcp-server) — `mcp-server/src/progressStore.ts`'s copy is typed
     *  against this same `ProgressState` interface, so a *required* field here would force that
     *  package to also know about a purely web-UI concern it has no other reason to care about.
     *  Read as `progress.plan.crunchExplainerSeen ?? false` at every call site, same pattern as
     *  `grades` above. */
    crunchExplainerSeen?: boolean;
  };
  setup: { checked: string[] };
  /** "system" defers to prefers-color-scheme (see lib/theme.ts's resolveThemeAttribute()). Default
   *  stays "dark" (not "system") so no existing persisted record sees an unrequested visual change
   *  the moment this field's type widened. */
  settings: { theme: "dark" | "light" | "system" };
}

const STORAGE_KEY = "snowprep.progress";
const DEBOUNCE_MS = 1000;

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

function loadFromStorage(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

let state: ProgressState = loadFromStorage();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// --- Backend: localStorage by default (today's behavior, and the fallback spec §4 calls for
// "when opened as plain files"), switching to the container's two-route HTTP adapter once a
// one-time boot probe confirms one exists. Everything above this point — and every caller in the
// app — is unaffected; only persist() below cares which backend is active. ---
type Backend = "localStorage" | "http";
let backend: Backend = "localStorage";

// The ETag (server's progress.json mtime) as of the last GET/successful PUT — see server.ts's
// If-Match check. progress.json also gets written directly by the snowprep-quiz MCP server
// (bind-mounted to the same file, no HTTP involved), so this tab's in-memory `state` goes stale
// the moment that happens. Without tracking a revision and checking it on write, this tab's next
// autosave — which can fire from routine navigation, not just an explicit edit — would silently
// overwrite whatever the MCP server just persisted. That already happened once; see
// progressStore.ts's ProgressConflictError for the other half of this fix.
let rev: string | null = null;
let conflictAt: string | null = null;

function setState(next: ProgressState): void {
  state = next;
  listeners.forEach((l) => l());
}

async function hydrateFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return; // no such route (e.g. `vite dev`, or opened as plain static files)
    const { rev: bodyRev, ...server } = await res.json();
    backend = "http";
    // Prefer the body-carried revision (issue #107) — Railway's edge doesn't reliably preserve the
    // ETag response header once a response is large enough to get gzip-compressed (confirmed live:
    // curl --compressed vs. plain curl against the identical request, ETag simply absent once
    // Content-Encoding: gzip applies — see server.ts's GET /api/progress comment for the full
    // finding). The header is still read as a fallback for any environment where it does survive.
    rev = bodyRev ?? res.headers.get("ETag");
    setState({ ...defaultState(), ...server });
  } catch {
    // network error / opened as plain files — stay on localStorage
  }
}
if (typeof window !== "undefined") hydrateFromServer();

async function persist(): Promise<void> {
  if (backend === "http") {
    try {
      const res = await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": rev ?? "0" },
        body: JSON.stringify(state),
      });
      if (res.status === 409) {
        // Someone else (almost certainly the MCP quiz server) wrote since this tab last read.
        // Re-sync to their copy rather than retrying the stale write — this tab's own pending
        // change is lost, but that's strictly better than silently erasing theirs.
        conflictAt = new Date().toISOString();
        console.warn(
          "progress.ts: PUT /api/progress conflict (409) — another writer updated progress.json first. " +
            "Re-hydrating from the server; this tab's most recent local change was not saved.",
        );
        await hydrateFromServer();
        return;
      }
      if (!res.ok) throw new Error(`PUT /api/progress → ${res.status}`);
      // See hydrateFromServer()'s comment (issue #107) for why the body-carried rev, not the
      // header, is the one actually trusted.
      const body = await res.json().catch(() => null);
      rev = body?.rev ?? res.headers.get("ETag");
    } catch (err) {
      console.error("progress PUT failed", err);
    }
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

/** Timestamp of the most recent write conflict, if any. `persist()` sets this and then always
 *  calls `hydrateFromServer()` -> `setState()` -> notifies `listeners` right after, so this value
 *  and the listener notification change together — safe to read via the same subscribe/listeners
 *  pair `useProgress()` uses, below. */
export function getLastProgressConflictAt(): string | null {
  return conflictAt;
}

/** Reactive form of `getLastProgressConflictAt()` — re-renders when a write conflict happens, so
 *  the UI can surface "a change didn't save" (see `ConflictBanner.tsx`) instead of this being
 *  silent beyond a console warning. */
export function useProgressConflict(): string | null {
  return useSyncExternalStore(subscribe, getLastProgressConflictAt, getLastProgressConflictAt);
}

function writeNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persist();
}

function scheduleWrite(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, DEBOUNCE_MS);
}

if (typeof window !== "undefined") {
  // Safety net for the debounced write: flush immediately if the tab is closing mid-debounce.
  window.addEventListener("beforeunload", writeNow);
}

export function getProgress(): ProgressState {
  return state;
}

/** Which store is actually backing reads/writes right now — spec §8's risk mitigation ("the
 *  header shows which store is active so the two can't be silently mixed"), surfaced in Settings. */
export function getStorageBackend(): Backend {
  return backend;
}

/** Always writes the whole object — no partial merges — per spec §4. */
export function updateProgress(next: ProgressState | ((prev: ProgressState) => ProgressState)): void {
  state = typeof next === "function" ? next(state) : next;
  scheduleWrite();
  listeners.forEach((l) => l());
}

/** Settings' "reset all progress" action — replaces everything with a fresh default state.
 *  Superseded by resetProgressConfirmed() below for the actual Settings button (issue #107); kept
 *  for any caller that only needs the fire-and-forget debounced-write behavior every other
 *  updateProgress() call already has. */
export function resetProgress(): void {
  updateProgress(defaultState());
}

/** Settings' "reset all progress" action, but actually confirmed persisted before the UI claims
 *  success (issue #107) — resetProgress()/persist()'s normal debounced write silently discards
 *  the change on a write conflict (409, "someone else wrote since our last read"), with only a
 *  console.warn, no user-visible signal, and no retry -- Settings' Reset button was unconditionally
 *  flipping to "Progress reset" the instant this function was *called*, regardless of whether the
 *  write a full second later (the debounce) ever actually happened or succeeded. Reproduced live:
 *  seeded real progress, clicked Reset, watched the button claim success while the server still
 *  had the old data seconds later.
 *
 *  Retrying on conflict is always safe here specifically *because* the target state never depends
 *  on what's currently stored -- it's always defaultState(), unlike a generic edit where blindly
 *  retrying a stale write could silently clobber someone else's concurrent change. Mirrors
 *  mcp-server/src/progressStore.ts's updateProgress() retry-on-conflict pattern, which already
 *  solves this correctly on that side.
 *
 *  Returns whether the reset was actually confirmed persisted -- the caller must not claim success
 *  until this resolves true. */
export async function resetProgressConfirmed(maxAttempts = 3): Promise<boolean> {
  if (saveTimer) {
    // A reset supersedes any pending debounced write from an earlier edit -- don't let that stale
    // write land after (or race with) this one.
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (backend !== "http") {
    setState(defaultState());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  }
  // Deliberately does NOT call setState(defaultState()) until a write is actually confirmed --
  // an earlier version of this function did it unconditionally on every attempt, which cleared
  // every reactive view of local state (Dashboard, Analytics, ...) before the write had even been
  // attempted, let alone confirmed. Caught live on a real account: "most of the data got reset but
  // Analytics remained the same" while the button was *simultaneously* reporting failure -- the
  // local optimistic clear and the real server outcome had nothing to do with each other. Nothing
  // about the visible app state should change until this function is actually about to return true.
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": rev ?? "0" },
        body: JSON.stringify(defaultState()),
      });
      if (res.status === 409) {
        // Re-sync the revision and retry -- the state we're writing (defaultState()) doesn't
        // change between attempts, so there's no "which change wins" question to get wrong here.
        // Body-carried rev, not the header -- see hydrateFromServer()'s comment (issue #107): this
        // exact retry loop is what first exposed the header being unreliable, since a stale/wrong
        // header value here means every retry re-sends the same wrong If-Match and 409s forever.
        const fresh = await fetch("/api/progress");
        const freshBody = await fresh.json().catch(() => null);
        rev = freshBody?.rev ?? fresh.headers.get("ETag");
        continue;
      }
      if (!res.ok) return false;
      const body = await res.json().catch(() => null);
      rev = body?.rev ?? res.headers.get("ETag");
      setState(defaultState());
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}
