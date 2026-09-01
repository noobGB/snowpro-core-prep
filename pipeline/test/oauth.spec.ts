/**
 * Tests for oauth.ts's Google token-exchange/verification logic, via a scripted global `fetch`
 * mock — the same technique already used in app/src/lib/progress.test.ts's HTTP-backend tests.
 * The "new user vs. existing user" account-linking and CSRF state-check logic live in server.ts's
 * routes, not here — this repo has no existing Express-route test harness (no supertest or
 * equivalent), so that part is verified live instead, the same way every other feature this
 * session was verified against a real running instance rather than a mocked route test.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";

async function importFresh() {
  vi.resetModules();
  process.env.SNOWPRO_GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.SNOWPRO_GOOGLE_CLIENT_SECRET = CLIENT_SECRET;
  return import("../src/oauth.js");
}

describe("oauth.ts", () => {
  afterEach(() => {
    delete process.env.SNOWPRO_GOOGLE_CLIENT_ID;
    delete process.env.SNOWPRO_GOOGLE_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it("isGoogleOAuthConfigured() is false when either env var is missing", async () => {
    vi.resetModules();
    delete process.env.SNOWPRO_GOOGLE_CLIENT_ID;
    delete process.env.SNOWPRO_GOOGLE_CLIENT_SECRET;
    const { isGoogleOAuthConfigured } = await import("../src/oauth.js");
    expect(isGoogleOAuthConfigured()).toBe(false);
  });

  it("buildAuthUrl() includes the client id, redirect uri, and state", async () => {
    const { buildAuthUrl } = await importFresh();
    const url = new URL(buildAuthUrl("https://example.com/callback", "abc123"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("scope")).toContain("email");
  });

  it("exchangeCodeForIdentity() returns the verified identity on a clean success path", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes("tokeninfo")) {
        return { ok: true, json: async () => ({ id_token: "fake.jwt.token" }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({ sub: "12345", email: "person@example.com", email_verified: "true", name: "Person", aud: CLIENT_ID }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeCodeForIdentity } = await importFresh();
    const identity = await exchangeCodeForIdentity("auth-code", "https://example.com/callback");
    expect(identity).toEqual({ sub: "12345", email: "person@example.com", name: "Person" });
  });

  it("rejects an unverified email even with an otherwise-valid token", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes("tokeninfo")) return { ok: true, json: async () => ({ id_token: "fake.jwt.token" }) } as Response;
      return {
        ok: true,
        json: async () => ({ sub: "12345", email: "person@example.com", email_verified: "false", name: "Person", aud: CLIENT_ID }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeCodeForIdentity } = await importFresh();
    await expect(exchangeCodeForIdentity("auth-code", "https://example.com/callback")).rejects.toThrow(/unverified/);
  });

  it("rejects a token whose aud doesn't match this app's client id", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes("tokeninfo")) return { ok: true, json: async () => ({ id_token: "fake.jwt.token" }) } as Response;
      return {
        ok: true,
        json: async () => ({ sub: "12345", email: "person@example.com", email_verified: "true", name: "Person", aud: "someone-elses-client-id" }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeCodeForIdentity } = await importFresh();
    await expect(exchangeCodeForIdentity("auth-code", "https://example.com/callback")).rejects.toThrow(/aud/);
  });

  it("rejects when Google's token endpoint itself returns an error", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 400, statusText: "Bad Request", text: async () => "invalid_grant" }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    const { exchangeCodeForIdentity } = await importFresh();
    await expect(exchangeCodeForIdentity("bad-code", "https://example.com/callback")).rejects.toThrow(/token exchange failed/);
  });
});

// Issue #129: the account-pre-hijacking fix. This is the one piece of GET /api/oauth/google/
// callback's account-linking logic that's genuinely pure (no DB/HTTP), extracted specifically so
// it has real unit coverage instead of "verified live" being the only claim behind it -- see
// resolveGoogleAccountLink()'s own doc comment in oauth.ts for the full attack scenario.
describe("resolveGoogleAccountLink()", () => {
  it("creates a brand-new account when no row exists for this email", async () => {
    const { resolveGoogleAccountLink } = await importFresh();
    expect(resolveGoogleAccountLink(undefined)).toBe("create");
  });

  it("links when the existing row has no password (legacy/Google-only account)", async () => {
    const { resolveGoogleAccountLink } = await importFresh();
    expect(resolveGoogleAccountLink({ passwordHash: null })).toBe("link");
  });

  it("refuses when the existing row already has a password -- the account-takeover case", async () => {
    const { resolveGoogleAccountLink } = await importFresh();
    expect(resolveGoogleAccountLink({ passwordHash: "scrypt$fake$hash" })).toBe("refuse");
  });
});
