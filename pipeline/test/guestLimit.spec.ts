/**
 * Tests the guest-creation limiter. This guards the only unauthenticated endpoint in the app that
 * writes a database row, and better-sqlite3 is synchronous -- a flood doesn't just fill the disk,
 * it blocks the event loop. So the global bucket (not just the per-IP window) is the assertion that
 * actually matters here, since per-IP limiting alone is defeated by any source diversity.
 */

import { describe, expect, it } from "vitest";
import { createGuestLimiter } from "../src/guestLimit.js";

describe("createGuestLimiter", () => {
  it("allows the first three from one address, then refuses", () => {
    const limiter = createGuestLimiter();
    for (let i = 0; i < 3; i++) {
      expect(limiter.check("1.2.3.4")).toBe("ok");
      limiter.record("1.2.3.4");
    }
    expect(limiter.check("1.2.3.4")).toBe("ip-limited");
  });

  it("keeps addresses independent of each other", () => {
    // A shared NAT genuinely can have several real people; the per-IP window is a burst cap, not
    // an attempt at per-person attribution (see registrationLimit.ts's header for the full case).
    const limiter = createGuestLimiter();
    for (let i = 0; i < 3; i++) limiter.record("1.2.3.4");
    expect(limiter.check("1.2.3.4")).toBe("ip-limited");
    expect(limiter.check("5.6.7.8")).toBe("ok");
  });

  it("refuses globally once the per-minute ceiling is hit, however many addresses are used", () => {
    // The backstop against a distributed flood, where every per-IP check would otherwise pass.
    const limiter = createGuestLimiter();
    for (let i = 0; i < 60; i++) {
      const ip = `10.0.${Math.floor(i / 256)}.${i % 256}`;
      expect(limiter.check(ip)).toBe("ok");
      limiter.record(ip);
    }
    expect(limiter.check("10.99.99.99")).toBe("global-limited");
  });

  it("reports the global refusal in preference to the per-IP one", () => {
    // The route logs these differently: a global refusal means the whole instance is at its
    // ceiling and is worth attention, while a per-IP refusal is routine.
    const limiter = createGuestLimiter();
    for (let i = 0; i < 60; i++) limiter.record(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    // This address is over BOTH limits; the global verdict must win.
    for (let i = 0; i < 3; i++) limiter.record("1.2.3.4");
    expect(limiter.check("1.2.3.4")).toBe("global-limited");
  });

  it("does not count a check that was never recorded", () => {
    // check() must be side-effect free: the route calls it before deciding, and a failed capacity
    // check further down means no row is created, so nothing should have been consumed.
    const limiter = createGuestLimiter();
    for (let i = 0; i < 10; i++) expect(limiter.check("1.2.3.4")).toBe("ok");
  });
});
