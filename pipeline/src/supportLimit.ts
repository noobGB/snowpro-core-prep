/**
 * Per-IP rate limiting for `POST /api/support` (issue #193).
 *
 * Its own module for the same reason `registrationLimit.ts` and `guestLimit.ts` are: the window
 * arithmetic and the boundary conditions are the part worth unit-testing, and they are untestable
 * while they live inline in a route.
 *
 * WHY THIS ENDPOINT NEEDS A LIMITER AT ALL, given the recipient is fixed and it can never be used
 * to spam a third party: an unauthenticated request that causes an outbound API call is a way to
 * burn someone else's money and reputation. Left open, it lets anyone fill the support mailbox
 * fast enough to bury a real report, and Brevo's per-account send quota is finite — exhaust it and
 * the *password reset* mail stops going out too, which is the one message a locked-out user must
 * receive. The blast radius is not "annoying inbox", it is "account recovery is down".
 *
 * Deliberately more generous than registration (which allows 3 per 10 minutes): a person hitting a
 * real problem may legitimately send a follow-up with a detail they forgot, and turning that into
 * an error message is a bad experience at the exact moment they are already frustrated.
 */

const MAX_PER_WINDOW = 5;
const WINDOW_MS = 15 * 60_000;

export interface SupportLimiter {
  /** True if `ip` has already sent MAX_PER_WINDOW messages inside the window. */
  isRateLimited(ip: string): boolean;
  /** Call once a message has actually been accepted for sending from `ip`. */
  recordSend(ip: string): void;
}

export function createSupportLimiter(): SupportLimiter {
  const sendsByIp = new Map<string, number[]>();

  /** Prunes as it reads, so an IP that stops sending stops occupying memory on its next touch.
   *  The map itself is unbounded in principle -- acceptable at this scale for the same reason
   *  registrationLimit.ts accepts it, and bounded in practice by the process lifetime. */
  function recentTimestamps(ip: string): number[] {
    const now = Date.now();
    const timestamps = (sendsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    sendsByIp.set(ip, timestamps);
    return timestamps;
  }

  return {
    isRateLimited(ip: string): boolean {
      return recentTimestamps(ip).length >= MAX_PER_WINDOW;
    },
    recordSend(ip: string): void {
      recentTimestamps(ip).push(Date.now());
    },
  };
}
