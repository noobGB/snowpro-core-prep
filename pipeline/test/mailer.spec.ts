/**
 * Tests mailer.ts's config-gating and message-building logic with global `fetch` mocked — issue
 * #95 switched this module from nodemailer/SMTP to Brevo's HTTP API, so what's mocked changed
 * accordingly (a real Brevo API round trip isn't something CI can or should do). What matters here
 * is that this module reads the right env vars, refuses clearly when they're missing, calls the
 * right Brevo endpoint/headers, and builds the right message body — not that Brevo actually
 * accepts it.
 *
 * Each test re-imports the module fresh (`vi.resetModules()`), matching this file's pre-#95
 * convention — mailer.ts has no module-level singleton anymore (no lazy transporter to leak
 * between tests the way nodemailer's did), but re-importing still isolates each test's env vars
 * cleanly, so the pattern is kept.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, statusText: "Created", text: async () => "" });

const ENV_KEYS = ["SNOWPRO_EMAIL_API_KEY", "SNOWPRO_EMAIL_FROM", "SNOWPRO_EMAIL_FROM_NAME"] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

async function importMailer() {
  return import("../src/mailer.js");
}

function lastRequestBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("isMailerConfigured", () => {
  it("is false when no SNOWPRO_EMAIL_* env vars are set", async () => {
    const { isMailerConfigured } = await importMailer();
    expect(isMailerConfigured()).toBe(false);
  });

  it("is true once api key and from are both set", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    const { isMailerConfigured } = await importMailer();
    expect(isMailerConfigured()).toBe(true);
  });

  it("is false when only one of the two required vars is set", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    const { isMailerConfigured } = await importMailer();
    expect(isMailerConfigured()).toBe(false);
  });
});

describe("sendPasswordResetEmail", () => {
  it("throws a clear error when email isn't configured, without ever calling fetch", async () => {
    const { sendPasswordResetEmail } = await importMailer();
    await expect(
      sendPasswordResetEmail("alice@example.com", "https://host/reset-password?token=abc"),
    ).rejects.toThrow(/configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Brevo's API with the right endpoint, api-key header, and sends the reset link in both bodies", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    const { sendPasswordResetEmail } = await importMailer();

    const resetUrl = "https://192.168.1.20:8080/reset-password?token=abc123";
    await sendPasswordResetEmail("alice@example.com", resetUrl);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "api-key": "xkeysib-test", "Content-Type": "application/json" }),
      }),
    );
    const body = lastRequestBody();
    expect(body).toMatchObject({
      sender: { email: "noreply@example.com", name: "SnowPro Core Prep" },
      to: [{ email: "alice@example.com" }],
    });
    expect(body.textContent).toContain(resetUrl);
    expect(body.htmlContent).toContain(resetUrl);
  });

  it("uses SNOWPRO_EMAIL_FROM_NAME as the sender name when set", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    process.env.SNOWPRO_EMAIL_FROM_NAME = "Custom Sender";
    const { sendPasswordResetEmail } = await importMailer();

    await sendPasswordResetEmail("alice@example.com", "https://host/reset-password?token=abc");

    expect(lastRequestBody()).toMatchObject({ sender: { name: "Custom Sender" } });
  });

  it("falls back to a real sender name when SNOWPRO_EMAIL_FROM_NAME is an EMPTY string", async () => {
    // The regression this exists for, found in production container logs: docker-compose.yml passes
    // `SNOWPRO_EMAIL_FROM_NAME: ${SNOWPRO_EMAIL_FROM_NAME:-}`, which sets the variable to "" rather
    // than leaving it unset. The old `?? "SnowPro Core Prep"` only falls back on null/undefined, so
    // Brevo received `name: ""` and rejected EVERY send with
    // {"code":"missing_parameter","message":"sender name is missing"} -- while isMailerConfigured()
    // still cheerfully reported true. Password reset was silently dead.
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    process.env.SNOWPRO_EMAIL_FROM_NAME = "";
    const { sendPasswordResetEmail } = await importMailer();

    await sendPasswordResetEmail("alice@example.com", "https://host/reset-password?token=abc");

    const sender = (lastRequestBody() as { sender: { name: string } }).sender;
    expect(sender.name.length).toBeGreaterThan(0);
  });

  it("falls back when SNOWPRO_EMAIL_FROM_NAME is only whitespace", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    process.env.SNOWPRO_EMAIL_FROM_NAME = "   ";
    const { sendPasswordResetEmail } = await importMailer();

    await sendPasswordResetEmail("alice@example.com", "https://host/reset-password?token=abc");

    const sender = (lastRequestBody() as { sender: { name: string } }).sender;
    expect(sender.name.trim().length).toBeGreaterThan(0);
  });

  it("throws when Brevo's API responds with a non-2xx status", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, statusText: "Unauthorized", text: async () => "bad key" });
    const { sendPasswordResetEmail } = await importMailer();

    await expect(
      sendPasswordResetEmail("alice@example.com", "https://host/reset-password?token=abc"),
    ).rejects.toThrow(/401/);
  });
});

// Issue #62: admin-provisioned accounts.
describe("sendAdminCreatedAccountEmail", () => {
  it("throws a clear error when email isn't configured, without ever calling fetch", async () => {
    const { sendAdminCreatedAccountEmail } = await importMailer();
    await expect(
      sendAdminCreatedAccountEmail("alice@example.com", "Alice", "tempPass123", "https://host/"),
    ).rejects.toThrow(/configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the temp password and login link in both the text and HTML bodies", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    const { sendAdminCreatedAccountEmail } = await importMailer();

    const loginUrl = "https://192.168.1.20:8080/";
    await sendAdminCreatedAccountEmail("alice@example.com", "Alice", "correct-horse-battery-9x2", loginUrl);

    const body = lastRequestBody();
    expect(body.to).toEqual([{ email: "alice@example.com" }]);
    expect(body.textContent).toContain("correct-horse-battery-9x2");
    expect(body.htmlContent).toContain("correct-horse-battery-9x2");
    expect(body.textContent).toContain(loginUrl);
    expect(body.htmlContent).toContain(loginUrl);
    // Also greets the recipient by name, unlike the reset email (which has no name to greet with).
    expect(body.textContent).toContain("Alice");
  });
});

// Issue #93: self-registered accounts.
describe("sendWelcomeEmail", () => {
  it("throws a clear error when email isn't configured, without ever calling fetch", async () => {
    const { sendWelcomeEmail } = await importMailer();
    await expect(sendWelcomeEmail("alice@example.com", "Alice", "https://host/")).rejects.toThrow(/configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("greets the recipient by name and includes the login link, no secret in the body", async () => {
    process.env.SNOWPRO_EMAIL_API_KEY = "xkeysib-test";
    process.env.SNOWPRO_EMAIL_FROM = "noreply@example.com";
    const { sendWelcomeEmail } = await importMailer();

    const loginUrl = "https://192.168.1.20:8080/";
    await sendWelcomeEmail("alice@example.com", "Alice", loginUrl);

    const body = lastRequestBody();
    expect(body.to).toEqual([{ email: "alice@example.com" }]);
    expect(body.textContent).toContain("Alice");
    expect(body.textContent).toContain(loginUrl);
    expect(body.htmlContent).toContain(loginUrl);
  });
});
