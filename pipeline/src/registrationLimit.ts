/**
 * Issue #142: a burst-based rate limit on new-account creation, extracted into its own module
 * (matching loginLockout.ts's shape) so it has real unit coverage rather than living untested
 * inline in a route.
 *
 * Deliberately NOT shaped like loginLockout.ts's exponential-backoff-per-email limiter, and
 * deliberately keyed by IP despite that same file's own comment warning that "an IP-keyed limiter
 * would either lock out an entire household together or not distinguish them at all" — that
 * warning is about distinguishing individual PEOPLE sharing a NAT for a per-person concern (wrong
 * password attempts), which registration isn't: the goal here is capping how fast NEW ACCOUNTS get
 * created from one source, not attributing attempts to one specific person. A shared office/campus
 * NAT genuinely can have many distinct people signing up -- but real people, even a lot of them,
 * don't organically cluster their signups within the same few minutes; they're spread across a
 * workday. A short burst window (not a long accumulating one, like "N per hour") is what actually
 * distinguishes bot-speed account creation (dozens within seconds) from organic multi-person
 * traffic on a shared IP, without needing per-person attribution at all.
 */

const MAX_SIGNUPS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60_000; // 10 minutes

export interface RegistrationLimiter {
  /** True if `ip` has already created MAX_SIGNUPS_PER_WINDOW accounts within the last WINDOW_MS --
   *  the caller should refuse this signup rather than create another one. */
  isRateLimited(ip: string): boolean;
  /** Call once a new account has actually been created from `ip`. */
  recordSignup(ip: string): void;
}

export function createRegistrationLimiter(): RegistrationLimiter {
  const signupsByIp = new Map<string, number[]>();

  function recentTimestamps(ip: string): number[] {
    const now = Date.now();
    const timestamps = (signupsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    signupsByIp.set(ip, timestamps);
    return timestamps;
  }

  return {
    isRateLimited(ip: string): boolean {
      return recentTimestamps(ip).length >= MAX_SIGNUPS_PER_WINDOW;
    },
    recordSignup(ip: string): void {
      recentTimestamps(ip).push(Date.now());
    },
  };
}
