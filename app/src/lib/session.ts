/**
 * Client for the identity/session HTTP routes (POST /api/session, GET /api/me, POST /api/logout,
 * POST /api/account/password[-setup], pipeline/src/server.ts) plus a tiny external store — same
 * useSyncExternalStore pattern as settingsStore.ts/paletteStore.ts — holding the current session's
 * {email, name} once resolved, so Dashboard's greeting and SettingsPanel's Profile section can
 * read it without prop-drilling through react-router's <Outlet>.
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
 *
 * Issue #46 (password login): `login()` now carries three possible non-terminal states alongside
 * the terminal `"known"` — `"new"` (unchanged from issue #41: unknown email, needs a name; now
 * also needs a password since new accounts require one from creation), `"needs_password_setup"`
 * (a legacy pre-#46 account claiming its first password), and `"needs_password"` (a normal
 * password-protected account). See server.ts's `POST /api/session` doc comment for the full
 * state-machine description this mirrors.
 */

import { useSyncExternalStore } from "react";

export interface SessionUser {
  email: string;
  name: string;
  /** Issue #46: `false` for a legacy pre-#46 account that hasn't claimed a password yet --
   *  SettingsPanel uses this to decide between offering "Set a password" (this account, via
   *  `setInitialPassword()`) or "Change password" (`changePassword()`). */
  hasPassword: boolean;
  /** Issue #62: `"admin"` unlocks the `/admin` page — `Sidebar.tsx` only shows that nav link when
   *  this is `"admin"`. Purely a UX convenience; the real enforcement is server-side
   *  (`requireAdmin` in `pipeline/src/server.ts`). */
  role: "user" | "admin";
  /** Issue #160: `true` for an ephemeral demo account created by "Explore the demo". Drives the
   *  guest banner and the mock-exam gate. Like `role`, this is presentation only — a guest's real
   *  limits are enforced server-side, and the content bundle is public regardless. */
  isGuest: boolean;
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
  | { authRequired: true; user: SessionUser | null; isPublicHost: boolean; guestAvailable: boolean };

/** Called once from App.tsx on boot to decide landing/gate-screen vs. the real app. `isPublicHost`
 *  (issue #121) only matters when `user` is `null` -- it's the server's per-request
 *  isPrivateNetworkHost() check (see server.ts), telling App.tsx whether this visitor arrived over
 *  a public hostname (real domain or localhost, landing page eligible) or a LAN private IP (skip
 *  straight to the gate, same reasoning as issue #119's Google-button hiding). */
export async function fetchMe(): Promise<MeResult> {
  try {
    const res = await fetch("/api/me");
    if (res.status === 401) {
      const body = (await res.json().catch(() => ({}))) as { isPublicHost?: boolean; guestAvailable?: boolean };
      return {
        authRequired: true,
        user: null,
        isPublicHost: body.isPublicHost === true,
        // Issue #160: rides this existing 401 body rather than its own /available route (as the
        // Google button needed) -- App.tsx already fetches exactly this, so advertising guest mode
        // costs no extra round trip on the cold visitor's critical path.
        guestAvailable: body.guestAvailable === true,
      };
    }
    if (!res.ok) return { authRequired: false };
    const user = (await res.json()) as SessionUser;
    currentUser = user;
    emit();
    return { authRequired: true, user, isPublicHost: false, guestAvailable: false };
  } catch {
    return { authRequired: false };
  }
}

export type LoginResult =
  | { ok: true; status: "known"; name: string }
  | { ok: true; status: "new" }
  | { ok: true; status: "needs_password_setup" }
  | { ok: true; status: "needs_password" }
  | { ok: true; status: "must_change_password" }
  | { ok: false; error: string };

export interface LoginOptions {
  /** New-account display name — sent together with `password` on a genuinely new email. */
  name?: string;
  /** Password for a normal login against an account that already has one, OR (sent alongside
   *  `name`) the password for a brand-new account being created right now, OR (issue #62, sent
   *  alongside `newPassword`) the TEMPORARY password being verified for an admin-provisioned
   *  account completing its forced first-login change. */
  password?: string;
  /** The password being claimed for a legacy (pre-issue-#46) account that has none set yet, OR
   *  (issue #62, sent alongside `password` as the temp password) the real password replacing an
   *  admin-provisioned account's temporary one. Same wire field, reused for both flows — both are
   *  "here is the new password," the only difference is what (if anything) had to be proven first. */
  newPassword?: string;
}

/** LoginGate's submit handler, per issue #46's three-state flow — `opts` is optional so a
 *  returning user's very first submit (email only) can determine which state applies in one round
 *  trip, matching server.ts's own `POST /api/session` contract exactly:
 *   - known email, password already set, no `password` sent -> `{status: "needs_password"}`,
 *     LoginGate reveals a Password field and resubmits with `{password}`.
 *   - known email, password already set, `password` sent -> `{status: "known", name}` on success,
 *     or `ok: false` on a wrong password / lockout.
 *   - known email, no password claimed yet, no `newPassword` sent -> `{status:
 *     "needs_password_setup"}`, LoginGate reveals a "set a password" field and resubmits with
 *     `{newPassword}`.
 *   - known email, no password claimed yet, `newPassword` sent -> claims it atomically and logs
 *     in, `{status: "known", name}` (or, vanishingly rarely, `{status: "needs_password"}` if
 *     someone else's claim won the race first).
 *   - unknown email, no `name`/`password` sent -> `{status: "new"}`, LoginGate reveals Name + a
 *     new-account Password field together.
 *   - unknown email, `name` + `password` sent -> creates the account, `{status: "known", name}`.
 *     (Deliberately `password`, not `newPassword`, for this one case -- server.ts's `!existing`
 *     branch checks `password`, matching "this is the password for the account being created
 *     right now" rather than "a password being claimed for something that already exists.")
 *  On a `"known"` result the caller must `window.location.reload()` — this function deliberately
 *  does NOT update the in-memory store or attempt to transition the SPA in place for that case,
 *  since progress.ts's own backend/rev state was already set (or not) by its module-load-time
 *  probe against the *previous* (nonexistent) session, and only a fresh page load re-runs that
 *  probe against the cookie this call just set. Every other status never sets a cookie, so there's
 *  nothing to reload for yet. */
export async function login(email: string, opts: LoginOptions = {}): Promise<LoginResult> {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...opts }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Login failed (${res.status}).` };
    }
    const data = (await res.json()) as {
      status: "known" | "new" | "needs_password_setup" | "needs_password" | "must_change_password";
      name?: string;
    };
    if (data.status === "known") return { ok: true, status: "known", name: data.name! };
    return { ok: true, status: data.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

export type PasswordActionResult = { ok: true } | { ok: false; error: string };

/** SettingsPanel's "Set a password" action for an already-logged-in legacy (pre-issue-#46)
 *  account — the preferred claim path over the login-gate fallback (see server.ts's
 *  POST /api/account/password-setup: the caller's own live session already proves ownership, so
 *  no current password is needed, only the new one). */
export async function setInitialPassword(newPassword: string): Promise<PasswordActionResult> {
  try {
    const res = await fetch("/api/account/password-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Failed (${res.status}).` };
    }
    // Flip the in-memory flag immediately -- no reload needed, unlike login()/logout(): this
    // action doesn't touch progress.ts's session-scoped state at all, only whether SettingsPanel
    // should now offer "Change password" instead of "Set a password".
    if (currentUser) {
      currentUser = { ...currentUser, hasPassword: true };
      emit();
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

/** SettingsPanel's "Change password" action — requires the current password even though a
 *  session is already live, so a moment of unattended device access can't silently take over the
 *  account's password. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<PasswordActionResult> {
  try {
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Failed (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

/** LoginGate's "Forgot password?" flow (issue #59) — always resolves `{ok: true}` on a successful
 *  round trip regardless of whether the email actually has an account, matching the server's
 *  enumeration-safe response (`POST /api/password-reset/request`): the caller shows the same
 *  generic "check your email" copy either way. `ok: false` only for a genuine request failure
 *  (network error, malformed email rejected client-side before this even runs, or SMTP not
 *  configured server-side — that last one *does* surface a real error, since it's an operator
 *  config fact, not per-account). */
export async function requestPasswordReset(email: string): Promise<PasswordActionResult> {
  try {
    const res = await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Failed (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

/** `ResetPasswordPage`'s submit handler (issue #59) — completes a reset started by
 *  `requestPasswordReset()`'s emailed link. Unlike every other function in this file, this runs
 *  with no live session at all (the whole point of the flow), so there's no in-memory store to
 *  update on success; the caller does a full `window.location.href = "/"` navigation instead, same
 *  reasoning as `login()`'s reload. */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<PasswordActionResult> {
  try {
    const res = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Failed (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

/** "Explore the demo" (issue #160): mints an ephemeral guest account and signs this browser in.
 *
 *  The caller MUST `window.location.reload()` on success, for exactly the reason `login()`'s own
 *  comment gives: progress.ts's module-level `backend`/`rev` state was set by its boot-time probe
 *  against the *previous* (nonexistent) session, and only a fresh page load re-runs that probe
 *  against the cookie this call just set. Transitioning in place would leave progress writes
 *  pointed at the wrong backend.
 *
 *  Safe to call more than once: the server returns the existing session rather than minting a
 *  second account for a browser that already holds a guest cookie. */
export async function startGuestSession(): Promise<PasswordActionResult> {
  try {
    const res = await fetch("/api/auth/guest", { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Couldn't start the demo (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}

/** Turns the current demo guest into a permanent account, in place (issue #160's conversion path).
 *
 *  CONTRACT this expects from `POST /api/account/upgrade` (server side not written yet):
 *   - Request:  `{ email: string, name: string, password: string }`, JSON, cookie-authenticated.
 *   - 200:      the full, updated user object — the same shape `GET /api/me` returns
 *               (`{email, name, hasPassword: true, role, isGuest: false}`). Returning the whole
 *               user (not `{ok: true}`) is what lets this function swap the in-memory store
 *               atomically instead of guessing at the new values.
 *   - 409:      `{error}` — that email already belongs to someone. `db.ts`'s `upgradeGuest()`
 *               already returns `null` for exactly this case; it must NOT merge two accounts.
 *   - 400:      `{error}` — validation (bad email, password under 8 chars, blank name).
 *   - 401/403:  `{error}` — no session, or the session isn't a guest (a real account has nothing
 *               to upgrade).
 *   - 429:      `{error}` — rate limited, same shape as the other public write endpoints.
 *  The server must also re-issue the session cookie with the normal 400-day `SESSION_MAX_AGE_MS`
 *  on success. The guest cookie was deliberately minted with only the guest TTL (see
 *  `POST /api/auth/guest`), and a converted account whose cookie silently expires in 7 days would
 *  be a worse bug than the one that TTL prevents.
 *
 *  UNLIKE `login()`/`logout()`/`startGuestSession()`, the caller must NOT reload. This is the same
 *  `user_id` before and after (the whole point of `upgradeGuest()`'s in-place UPDATE), so
 *  progress.ts's module-level backend/rev state — the only reason those three reload — is still
 *  correct. Emitting the new user instead lets every `useSessionUser()` consumer re-render live:
 *  the guest banner disappears and the mock exams unlock in place, which is a far better
 *  conversion moment than a full page reload that dumps the user back on the dashboard. */
export async function upgradeToAccount(
  email: string,
  name: string,
  password: string,
): Promise<PasswordActionResult> {
  try {
    const res = await fetch("/api/account/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? `Couldn't create the account (${res.status}).` };
    }
    const user = (await res.json()) as SessionUser;
    currentUser = user;
    emit();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
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
