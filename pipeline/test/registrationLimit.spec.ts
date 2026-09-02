/**
 * Issue #142: caps how fast new accounts can be created from one source (see
 * registrationLimit.ts's own header comment for why this is a short burst window, IP-keyed,
 * rather than loginLockout.ts's per-email exponential backoff). These tests pin the actual shape
 * of the fix: a burst trips the limit, spread-out organic signups don't, and the window actually
 * expires.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRegistrationLimiter, type RegistrationLimiter } from "../src/registrationLimit.js";

const IP = "203.0.113.5";
const MAX_SIGNUPS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60_000;

let limiter: RegistrationLimiter;

beforeEach(() => {
  vi.useFakeTimers();
  limiter = createRegistrationLimiter();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRegistrationLimiter()", () => {
  it("allows signups below the burst threshold", () => {
    for (let i = 0; i < MAX_SIGNUPS_PER_WINDOW - 1; i++) {
      expect(limiter.isRateLimited(IP)).toBe(false);
      limiter.recordSignup(IP);
    }
    expect(limiter.isRateLimited(IP)).toBe(false);
  });

  it("rate-limits once the burst threshold is hit within the window", () => {
    for (let i = 0; i < MAX_SIGNUPS_PER_WINDOW; i++) limiter.recordSignup(IP);
    expect(limiter.isRateLimited(IP)).toBe(true);
  });

  it("a bot creating dozens of accounts in seconds trips the limit almost immediately", () => {
    for (let i = 0; i < 50; i++) {
      if (limiter.isRateLimited(IP)) break;
      limiter.recordSignup(IP);
      vi.advanceTimersByTime(1000); // 1 second apart -- bot speed, not human speed
    }
    expect(limiter.isRateLimited(IP)).toBe(true);
  });

  it("organic signups spread across a workday (minutes apart, below the window's cap) never trip the limit", () => {
    // 5 people from the same shared office IP, each signing up ~40 minutes apart across a workday
    // -- well outside any single 10-minute window, however many happen over the whole day.
    for (let i = 0; i < 10; i++) {
      expect(limiter.isRateLimited(IP)).toBe(false);
      limiter.recordSignup(IP);
      vi.advanceTimersByTime(40 * 60_000);
    }
  });

  it("the burst window actually expires -- signups age out and the limit lifts", () => {
    for (let i = 0; i < MAX_SIGNUPS_PER_WINDOW; i++) limiter.recordSignup(IP);
    expect(limiter.isRateLimited(IP)).toBe(true);
    vi.advanceTimersByTime(WINDOW_MS + 1000);
    expect(limiter.isRateLimited(IP)).toBe(false);
  });

  it("different IPs are tracked independently", () => {
    for (let i = 0; i < MAX_SIGNUPS_PER_WINDOW; i++) limiter.recordSignup(IP);
    expect(limiter.isRateLimited(IP)).toBe(true);
    expect(limiter.isRateLimited("198.51.100.9")).toBe(false);
  });
});
