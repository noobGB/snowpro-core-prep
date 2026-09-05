/**
 * Tests the support-form rate limiter (issue #193).
 *
 * Why this is worth testing rather than trusting: the limiter is the only thing standing between an
 * unauthenticated endpoint and Brevo's finite send quota. Exhausting that quota does not just fill
 * the support mailbox — it stops password-reset mail going out, which is the one message a
 * locked-out user must receive. The failure mode is "account recovery is down", not "noisy inbox".
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { createSupportLimiter } from "../src/supportLimit.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("createSupportLimiter", () => {
  it("allows the first sends and refuses the one past the cap", () => {
    const limiter = createSupportLimiter();
    for (let i = 0; i < 5; i++) {
      expect(limiter.isRateLimited("1.2.3.4"), `send ${i + 1} should be allowed`).toBe(false);
      limiter.recordSend("1.2.3.4");
    }
    expect(limiter.isRateLimited("1.2.3.4")).toBe(true);
  });

  it("keeps IPs independent", () => {
    // One noisy sender must not lock out everyone else -- the shared-counter mistake.
    const limiter = createSupportLimiter();
    for (let i = 0; i < 5; i++) limiter.recordSend("1.2.3.4");
    expect(limiter.isRateLimited("1.2.3.4")).toBe(true);
    expect(limiter.isRateLimited("5.6.7.8")).toBe(false);
  });

  it("forgets sends once the window has passed", () => {
    vi.useFakeTimers();
    const limiter = createSupportLimiter();
    for (let i = 0; i < 5; i++) limiter.recordSend("1.2.3.4");
    expect(limiter.isRateLimited("1.2.3.4")).toBe(true);

    vi.advanceTimersByTime(15 * 60_000 + 1);
    expect(limiter.isRateLimited("1.2.3.4")).toBe(false);
  });

  it("slides rather than resetting in fixed blocks", () => {
    // A fixed-window limiter lets someone send the cap twice back-to-back across a boundary. This
    // one prunes by age, so partial expiry frees exactly one slot.
    vi.useFakeTimers();
    const limiter = createSupportLimiter();
    for (let i = 0; i < 5; i++) {
      limiter.recordSend("1.2.3.4");
      vi.advanceTimersByTime(60_000); // one minute apart
    }
    expect(limiter.isRateLimited("1.2.3.4")).toBe(true);

    // Enough for only the oldest to age out.
    vi.advanceTimersByTime(10 * 60_000 + 1);
    expect(limiter.isRateLimited("1.2.3.4")).toBe(false);
    limiter.recordSend("1.2.3.4");
    expect(limiter.isRateLimited("1.2.3.4")).toBe(true);
  });

  it("treats a missing IP as its own bucket rather than throwing", () => {
    // server.ts passes `req.ip ?? ""`. An empty key must behave like any other, not crash the route.
    const limiter = createSupportLimiter();
    expect(() => limiter.isRateLimited("")).not.toThrow();
    for (let i = 0; i < 5; i++) limiter.recordSend("");
    expect(limiter.isRateLimited("")).toBe(true);
  });
});
