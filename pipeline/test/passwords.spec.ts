/**
 * Tests passwords.ts's hash/verify round trip against real scrypt calls (no mocking node:crypto --
 * these are cheap enough at this app's cost parameters to run for real in CI, and mocking would
 * defeat the point of testing the actual derived-key comparison).
 */

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "../src/passwords.js";

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password against its own hash", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password entirely", hash)).toBe(false);
  });

  it("rejects an empty-string guess against a real hash", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("two hashes of the same password are different (random salt per call)", () => {
    const a = hashPassword("same password");
    const b = hashPassword("same password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same password", a)).toBe(true);
    expect(verifyPassword("same password", b)).toBe(true);
  });

  it("stores a self-describing scrypt$N$r$p$salt$hash format", () => {
    const hash = hashPassword("whatever");
    const parts = hash.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBeGreaterThan(0); // N
    expect(parts[4]).toMatch(/^[0-9a-f]+$/); // salt hex
    expect(parts[5]).toMatch(/^[0-9a-f]+$/); // hash hex
  });

  it("verifyPassword returns false, not a throw, for a malformed stored value", () => {
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
    expect(verifyPassword("anything", "scrypt$bad$format")).toBe(false);
    expect(verifyPassword("anything", "bcrypt$10$saltHex$hashHex")).toBe(false);
  });

  it("MIN_PASSWORD_LENGTH matches the app-wide floor used by server.ts/LoginGate/SettingsPanel", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
