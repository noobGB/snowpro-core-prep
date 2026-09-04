/**
 * Configuration for guest ("Explore the demo") accounts, resolved from the environment.
 *
 * Extracted into its own module for the same reason `loginLockout.ts` and `registrationLimit.ts`
 * were: the enabled/disabled and clamping branches are exactly the logic worth unit-testing, and
 * they're untestable while they live inline in a route.
 *
 * DEFAULT OFF, deliberately, matching how `SNOWPRO_GOOGLE_*` and `SNOWPRO_EMAIL_*` already behave
 * ("unset means the feature does not exist and the UI hides it, rather than showing a control that
 * fails"). Three reasons this particular default matters more than consistency:
 *
 *  1. A self-hosted LAN box gains nothing from guest mode and would otherwise silently acquire a
 *     new *unauthenticated write endpoint* on upgrade. Defaults must be safe for the person who
 *     didn't read the changelog.
 *  2. It is the launch-day kill switch. `release.yml` only publishes an image on a `vX.Y.Z` tag, so
 *     a code change is minutes of CI away; a Railway variable change plus a restart is under a
 *     minute. This is the only fast incident lever that exists.
 *  3. It keeps the blast radius of the reaper (the first automatic user-row DELETE in this system)
 *     opt-in.
 */

export type GuestReapMode = "log" | "delete";

export interface GuestConfig {
  enabled: boolean;
  /** Inactivity window after which a guest row is eligible for reaping. */
  ttlMs: number;
  /** Cap on simultaneously-live guest rows, past which the endpoint refuses rather than evicts. */
  maxLive: number;
  /** "log" reports what it *would* delete without deleting. See `SNOWPRO_GUEST_REAP` below. */
  reapMode: GuestReapMode;
}

const DAY_MS = 86_400_000;
const DEFAULT_TTL_DAYS = 7;
/** A TTL below a day would let a reap fire while someone is still plausibly using the demo across a
 *  lunch break. Clamping rather than trusting the value means a typo ("0") can't wipe every live
 *  guest, which is the one input mistake here with irreversible consequences. */
const MIN_TTL_DAYS = 1;
const DEFAULT_MAX_LIVE = 500;

function parsePositiveInt(raw: string | undefined, fallback: number, min: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

/** Truthy values accepted for the on-switch. Anything else -- including "false", "0" and a typo --
 *  leaves the feature off, because the failure a wrong value should produce is "the demo button is
 *  missing", never "an anonymous write endpoint is open without anyone intending it". */
function parseEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function resolveGuestConfig(env: NodeJS.ProcessEnv = process.env): GuestConfig {
  return {
    enabled: parseEnabled(env.SNOWPRO_ENABLE_GUEST),
    ttlMs: parsePositiveInt(env.SNOWPRO_GUEST_TTL_DAYS, DEFAULT_TTL_DAYS, MIN_TTL_DAYS) * DAY_MS,
    maxLive: parsePositiveInt(env.SNOWPRO_GUEST_MAX_LIVE, DEFAULT_MAX_LIVE, 1),
    // Anything other than an explicit "delete" stays in log mode. Same reasoning as parseEnabled():
    // the safe state is the one a misconfiguration falls back to.
    reapMode: env.SNOWPRO_GUEST_REAP?.trim().toLowerCase() === "delete" ? "delete" : "log",
  };
}
