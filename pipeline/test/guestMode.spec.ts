/**
 * Tests resolveGuestConfig()'s env parsing. The cases that matter are the malformed ones: this
 * config gates an unauthenticated write endpoint and an automatic row deletion, so what a bad value
 * falls back to is the whole point, not an edge case.
 */

import { describe, expect, it } from "vitest";
import { resolveGuestConfig } from "../src/guestMode.js";

const DAY = 86_400_000;

describe("resolveGuestConfig", () => {
  it("is off, log-mode and 7-day TTL with a completely empty environment", () => {
    const c = resolveGuestConfig({});
    expect(c.enabled).toBe(false);
    expect(c.reapMode).toBe("log");
    expect(c.ttlMs).toBe(7 * DAY);
    expect(c.maxLive).toBe(500);
  });

  it("accepts the usual truthy spellings for the on-switch", () => {
    for (const v of ["1", "true", "TRUE", " yes ", "on"]) {
      expect(resolveGuestConfig({ SNOWPRO_ENABLE_GUEST: v }).enabled).toBe(true);
    }
  });

  it("stays OFF for anything that isn't clearly on", () => {
    // A misconfiguration must fail towards "the demo button is missing", never towards "an
    // anonymous write endpoint is open that nobody meant to open".
    for (const v of ["", "0", "false", "no", "off", "maybe", "TRUEISH"]) {
      expect(resolveGuestConfig({ SNOWPRO_ENABLE_GUEST: v }).enabled).toBe(false);
    }
  });

  it("stays in log mode unless reaping is explicitly requested", () => {
    expect(resolveGuestConfig({ SNOWPRO_GUEST_REAP: "delete" }).reapMode).toBe("delete");
    expect(resolveGuestConfig({ SNOWPRO_GUEST_REAP: " DELETE " }).reapMode).toBe("delete");
    for (const v of ["", "log", "true", "1", "remove", "yes"]) {
      expect(resolveGuestConfig({ SNOWPRO_GUEST_REAP: v }).reapMode).toBe("log");
    }
  });

  it("clamps the TTL to at least one day", () => {
    // The one input mistake here with irreversible consequences: TTL 0 would make every live guest
    // immediately eligible for deletion on the next sweep.
    expect(resolveGuestConfig({ SNOWPRO_GUEST_TTL_DAYS: "0" }).ttlMs).toBe(1 * DAY);
    expect(resolveGuestConfig({ SNOWPRO_GUEST_TTL_DAYS: "-30" }).ttlMs).toBe(1 * DAY);
    expect(resolveGuestConfig({ SNOWPRO_GUEST_TTL_DAYS: "3" }).ttlMs).toBe(3 * DAY);
  });

  it("falls back to defaults for unparseable numbers rather than producing NaN", () => {
    expect(resolveGuestConfig({ SNOWPRO_GUEST_TTL_DAYS: "abc" }).ttlMs).toBe(7 * DAY);
    expect(resolveGuestConfig({ SNOWPRO_GUEST_TTL_DAYS: "   " }).ttlMs).toBe(7 * DAY);
    expect(resolveGuestConfig({ SNOWPRO_GUEST_MAX_LIVE: "abc" }).maxLive).toBe(500);
    expect(resolveGuestConfig({ SNOWPRO_GUEST_MAX_LIVE: "0" }).maxLive).toBe(1);
    expect(resolveGuestConfig({ SNOWPRO_GUEST_MAX_LIVE: "25" }).maxLive).toBe(25);
  });
});
