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
  plan: { checked: string[] };
  setup: { checked: string[] };
  settings: { theme: "dark" };
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
    const server = await res.json();
    backend = "http";
    rev = res.headers.get("ETag");
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
      rev = res.headers.get("ETag");
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

/** Settings' "reset all progress" action — replaces everything with a fresh default state. */
export function resetProgress(): void {
  updateProgress(defaultState());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}
