/**
 * Progress storage adapter, per spec §4's Progress schema. Only the localStorage backend exists
 * so far — the real two-route adapter (GET/PUT /api/progress, backed by the Docker volume) is
 * build-order step 15. This module is written as the seam that step 15 will swap the backend
 * behind, per the plan's own note: "Build the storage adapter early... so no screen ever talks
 * to localStorage directly" — callers use `useProgress()`/`updateProgress()`, never
 * `localStorage` directly.
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
  flashcards: { seen: string[]; lastIndex: number };
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
    flashcards: { seen: [], lastIndex: 0 },
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

function writeNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function scheduleWrite(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, DEBOUNCE_MS);
}

if (typeof window !== "undefined") {
  // Safety net for the debounced write: flush immediately if the tab is closing mid-debounce.
  window.addEventListener("beforeunload", writeNow);
}

export function getProgress(): ProgressState {
  return state;
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
