/**
 * Issue #131: the login-lockout duration used to grow completely unbounded
 * (`LOGIN_LOCKOUT_BASE_MS * 2 ** extraFailures`, no ceiling) -- since lockout is keyed by email,
 * not IP, anyone who merely knew a victim's email could sustain a burst of wrong-password guesses
 * and drive the lockout toward hours/days, an effectively-permanent denial of service. These tests
 * pin the fix: the lockout duration is capped, and normal (non-attack) behavior is unchanged.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLoginLockout, type LoginLockout } from "../src/loginLockout.js";

const EMAIL = "victim@example.com";
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_LOGIN_LOCKOUT_MS = 15 * 60_000;

let lockout: LoginLockout;

beforeEach(() => {
  vi.useFakeTimers();
  lockout = createLoginLockout();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createLoginLockout()", () => {
  it("allows attempts before the failure threshold is reached", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) lockout.recordFailedAttempt(EMAIL);
    expect(lockout.checkRateLimit(EMAIL)).toBeUndefined();
  });

  it("locks out after the failure threshold", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) lockout.recordFailedAttempt(EMAIL);
    expect(lockout.checkRateLimit(EMAIL)).toBeGreaterThan(0);
  });

  it("a successful attempt clears the failure count entirely", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) lockout.recordFailedAttempt(EMAIL);
    expect(lockout.checkRateLimit(EMAIL)).toBeGreaterThan(0);
    lockout.recordSuccessfulAttempt(EMAIL);
    expect(lockout.checkRateLimit(EMAIL)).toBeUndefined();
  });

  it("the lockout duration never exceeds the cap, even after a large sustained burst", () => {
    // Well beyond the threshold -- uncapped exponential backoff would put this in the
    // years-long range (2^45 seconds). The fix must clamp it to MAX_LOGIN_LOCKOUT_MS.
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS + 50; i++) lockout.recordFailedAttempt(EMAIL);
    const remainingSec = lockout.checkRateLimit(EMAIL)!;
    expect(remainingSec).toBeLessThanOrEqual(MAX_LOGIN_LOCKOUT_MS / 1000);
    // And it should actually be locked at the cap, not some tiny/zero value -- confirms the branch
    // was reached, not just that the assertion above is vacuously true.
    expect(remainingSec).toBeGreaterThan(MAX_LOGIN_LOCKOUT_MS / 1000 - 5);
  });

  it("lockout expires and further attempts are allowed again after the capped duration passes", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS + 50; i++) lockout.recordFailedAttempt(EMAIL);
    expect(lockout.checkRateLimit(EMAIL)).toBeGreaterThan(0);
    vi.advanceTimersByTime(MAX_LOGIN_LOCKOUT_MS + 1000);
    expect(lockout.checkRateLimit(EMAIL)).toBeUndefined();
  });

  it("lockouts are tracked independently per email", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) lockout.recordFailedAttempt(EMAIL);
    expect(lockout.checkRateLimit(EMAIL)).toBeGreaterThan(0);
    expect(lockout.checkRateLimit("someone-else@example.com")).toBeUndefined();
  });

  it("email matching is case/whitespace-normalized, same as the rest of this app's identity lookups", () => {
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) lockout.recordFailedAttempt("  Victim@Example.com  ");
    expect(lockout.checkRateLimit(EMAIL)).toBeGreaterThan(0);
  });
});
