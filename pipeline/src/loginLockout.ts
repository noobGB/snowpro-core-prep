/**
 * Issue #46's brute-force guard, extracted out of server.ts (issue #131) so its cap logic has real
 * unit coverage -- this repo has no route-level test harness, so anything left inline in a route
 * only gets "verified live" as a claim, not an actual test.
 *
 * A lightweight in-memory lockout on repeated wrong-password attempts, keyed by normalized email
 * rather than IP -- LAN clients behind the same router/NAT don't reliably differ by source IP, so
 * an IP-keyed limiter would either lock out an entire household together or not distinguish them
 * at all. In-memory (not persisted) is fine at this app's scale: a container restart clearing
 * lockouts is an acceptable reset, not a security hole.
 *
 * `createLoginLockout()` is a factory (not a module-level singleton) specifically so tests can
 * exercise a fresh, isolated instance each time rather than sharing one Map across the whole test
 * file -- server.ts itself only ever calls this once, at module load, same effective lifetime as
 * before the extraction.
 */

import { normalizeEmail } from "./db.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_BASE_MS = 30_000;
// Security (issue #131): the exponential backoff below (`LOGIN_LOCKOUT_BASE_MS * 2 **
// extraFailures`) grew completely unbounded until this cap was added -- since lockout is keyed by
// email, not IP or any other attacker-scarce resource, anyone who merely knows a victim's email
// could keep submitting wrong passwords and drive the lockout duration toward hours/days, an
// effectively-permanent denial of service against that one account with no rate limit of their own
// to slow them down. Capping the ceiling doesn't stop a *sustained* attacker from re-triggering a
// fresh lockout the moment one expires, but it bounds the worst case to something a real user can
// wait out, rather than a single burst of guesses locking them out for an unbounded, ever-doubling
// stretch.
const MAX_LOGIN_LOCKOUT_MS = 15 * 60_000;

export interface LoginLockout {
  /** Remaining lockout in whole seconds if `email` is currently locked out, or `undefined` if a
   *  login attempt can proceed right now. */
  checkRateLimit(email: string): number | undefined;
  recordFailedAttempt(email: string): void;
  recordSuccessfulAttempt(email: string): void;
}

export function createLoginLockout(): LoginLockout {
  const attempts = new Map<string, { failures: number; lockedUntil: number }>();

  return {
    checkRateLimit(email: string): number | undefined {
      const entry = attempts.get(normalizeEmail(email));
      if (!entry || entry.lockedUntil <= Date.now()) return undefined;
      return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    },

    recordFailedAttempt(email: string): void {
      const key = normalizeEmail(email);
      const entry = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
      entry.failures += 1;
      if (entry.failures >= MAX_LOGIN_ATTEMPTS) {
        const extraFailures = entry.failures - MAX_LOGIN_ATTEMPTS;
        entry.lockedUntil = Date.now() + Math.min(LOGIN_LOCKOUT_BASE_MS * 2 ** extraFailures, MAX_LOGIN_LOCKOUT_MS);
      }
      attempts.set(key, entry);
    },

    recordSuccessfulAttempt(email: string): void {
      attempts.delete(normalizeEmail(email));
    },
  };
}
