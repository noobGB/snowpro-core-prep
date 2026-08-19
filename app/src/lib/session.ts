/**
 * Client for the identity/session HTTP routes (POST /api/session, GET /api/me, POST /api/logout,
 * pipeline/src/server.ts) plus a tiny external store — same useSyncExternalStore pattern as
 * settingsStore.ts/paletteStore.ts — holding the current session's {email, name} once resolved,
 * so Dashboard's greeting and SettingsPanel's Profile section can read it without prop-drilling
 * through react-router's <Outlet>.
 *
 * Mirrors progress.ts's own boot-probe shape: GET /api/me returning anything other than 401 (a
 * real "not logged in" from a server that has this route at all) means "no auth system here" —
 * `vite dev` without the container, or the built files opened as plain static files — and the app
 * renders exactly as it did before this feature existed, gate screen included, not a hard error.
 *
 * A full page reload (not a React state transition) is the deliberate mechanism for both
 * completing a login and signing out — see login()/logout()'s own comments for why: it's what
 * lets progress.ts's own module-level state (`backend`/`rev`, set once at module-load time by its
 * own hydrateFromServer() probe) end up correctly synced to the new session's cookie with zero
 * changes to that file, rather than needing a second, parallel "re-hydrate" entry point bolted on
 * for this feature alone.
 */

import { useSyncExternalStore } from "react";

export interface SessionUser {
  email: string;
  name: string;
}

let currentUser: SessionUser | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The signed-in user, once `fetchMe()` (called once at App boot) has resolved — `null` both
 *  before that resolves and when no auth system is present at all (see this file's own header
 *  comment), so callers that just want "do I have a name to greet with" don't need to distinguish
 *  the two. */
export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(subscribe, () => currentUser, () => currentUser);
}

export type MeResult =
  | { authRequired: false }
  | { authRequired: true; user: SessionUser | null };

/** Called once from App.tsx on boot to decide gate-screen vs. the real app. */
export async function fetchMe(): Promise<MeResult> {
  try {
    const res = await fetch("/api/me");
    if (res.status === 401) return { authRequired: true, user: null };
    if (!res.ok) return { authRequired: false };
    const user = (await res.json()) as SessionUser;
    currentUser = user;
    emit();
    return { authRequired: true, user };
  } catch {
    return { authRequired: false };
  }
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/** LoginGate's submit handler. On success the caller must `window.location.reload()` — this
 *  function deliberately does NOT update the in-memory store or attempt to transition the SPA in
 *  place, since progress.ts's own backend/rev state was already set (or not) by its module-load-
 *  time probe against the *previous* (nonexistent) session, and only a fresh page load re-runs
 *  that probe against the cookie this call just set. */
export async function login(email: string, name: string): Promise<LoginResult> {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Login failed (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

/** SettingsPanel's inline name edit: re-calls POST /api/session with the SAME email + the new
 *  name, which pipeline/src/server.ts's route treats as "update this account's display name in
 *  place," never a new account (email is the only identity key). Unlike login(), this updates the
 *  in-memory store directly and does NOT reload the page — a display-name edit doesn't touch
 *  progress.ts's session-scoped state at all, so there's nothing that needs a fresh boot probe. */
export async function updateName(name: string): Promise<LoginResult> {
  if (!currentUser) return { ok: false, error: "Not logged in." };
  const result = await login(currentUser.email, name);
  if (result.ok) {
    currentUser = { ...currentUser, name };
    emit();
  }
  return result;
}

/** SettingsPanel's "Sign out": clears the server-side session, then the caller must
 *  `window.location.reload()` (same reasoning as login() above, in reverse — a clean reload is
 *  what resets progress.ts's in-memory state so the next person on this shared machine doesn't
 *  see the previous person's cached data for a moment before the gate screen appears). */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch {
    // Best-effort -- the caller reloads the page regardless, which is what actually matters for
    // clearing this tab's own state; a failed logout call just means the cookie/session row may
    // outlive this tab slightly longer server-side.
  }
  currentUser = null;
  emit();
}
