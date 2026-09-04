/**
 * Rate limiting for `POST /api/auth/guest`, the one endpoint in this app that writes a row to the
 * database without any authentication at all.
 *
 * Why this needs more than `registrationLimit.ts`'s single per-IP window: `better-sqlite3` is
 * synchronous, so a flood of guest creation doesn't merely fill the disk, it blocks the Node event
 * loop and takes the whole site down with it. The per-IP window alone is defeated by any source
 * diversity, so there is a second, global bucket underneath it that bounds total creation rate
 * regardless of how many addresses the traffic arrives from.
 *
 * Keyed by IP for the same reason `registrationLimit.ts` is, and its header comment argues the case
 * in full: capping *how fast rows get created from one source* is not the same concern as
 * attributing attempts to one specific person, so the usual "a NAT shares one IP" objection (which
 * `loginLockout.ts` correctly raises for password attempts) doesn't apply. `app.set("trust proxy",
 * 1)` is already configured in server.ts, so `req.ip` is the real client address behind Railway's
 * edge -- this limiter inherits that, and needs no separate handling.
 *
 * State is in-memory and resets on every redeploy. That's the same accepted tradeoff the two
 * existing limiters make; the real incident lever is `SNOWPRO_ENABLE_GUEST`, not this.
 */

/** One human needs exactly one. Three absorbs a double-click, a refresh, and a genuinely shared
 *  household/NAT without being useful to a script. */
const MAX_GUESTS_PER_IP_WINDOW = 3;
const IP_WINDOW_MS = 10 * 60_000;
/** Global ceiling across all sources. Sized well above any plausible organic launch-day rate (a
 *  front-page spike is single-digit signups per second at most) and well below what would keep the
 *  event loop busy. */
const MAX_GUESTS_PER_MINUTE_GLOBAL = 60;
const GLOBAL_WINDOW_MS = 60_000;

export type GuestLimitVerdict = "ok" | "ip-limited" | "global-limited";

export interface GuestLimiter {
  /** Checked before minting. Returns why it was refused so the route can log the two cases
   *  differently -- a global refusal is an incident signal, a per-IP one is routine. */
  check(ip: string): GuestLimitVerdict;
  /** Call once a guest row has actually been created for `ip`. */
  record(ip: string): void;
}

export function createGuestLimiter(): GuestLimiter {
  const byIp = new Map<string, number[]>();
  let globalHits: number[] = [];

  function recentForIp(ip: string): number[] {
    const now = Date.now();
    const kept = (byIp.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
    byIp.set(ip, kept);
    return kept;
  }

  function recentGlobal(): number[] {
    const now = Date.now();
    globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);
    return globalHits;
  }

  return {
    check(ip: string): GuestLimitVerdict {
      // Global first: under a distributed flood every per-IP check would pass, and the point of
      // the global bucket is to be the backstop that still refuses.
      if (recentGlobal().length >= MAX_GUESTS_PER_MINUTE_GLOBAL) return "global-limited";
      if (recentForIp(ip).length >= MAX_GUESTS_PER_IP_WINDOW) return "ip-limited";
      return "ok";
    },
    record(ip: string): void {
      const now = Date.now();
      recentForIp(ip).push(now);
      recentGlobal().push(now);
      // recentForIp/recentGlobal both mutate the arrays they return in place (the Map holds the
      // same reference, and globalHits is reassigned by the filter above), so there is nothing to
      // write back here. Kept explicit because a future refactor that returns copies would break
      // this silently.
    },
  };
}
