/**
 * Tests mailer.ts's config-gating and message-building logic with nodemailer's `createTransport`
 * mocked -- unlike db.spec.ts/passwords.spec.ts's "no mocking" style, an actual SMTP round trip
 * isn't something CI can or should do; what matters here is that this module reads the right env
 * vars, refuses clearly when they're missing, and builds the right message, not that a real mail
 * server accepts it.
 *
 * Each test re-imports the module fresh (`vi.resetModules()`) rather than relying on Node's module
 * cache, since mailer.ts's transporter is a lazily-created module-level singleton -- reusing it
 * across tests would let an earlier test's env vars leak into a later test's assertions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test" });
const createTransportMock = vi.fn((_config: unknown) => ({ sendMail: sendMailMock }));

vi.mock("nodemailer", () => ({
  default: { createTransport: (config: unknown) => createTransportMock(config) },
}));

const ENV_KEYS = [
  "SNOWPRO_SMTP_HOST",
  "SNOWPRO_SMTP_PORT",
  "SNOWPRO_SMTP_USER",
  "SNOWPRO_SMTP_PASS",
  "SNOWPRO_SMTP_FROM",
  "SNOWPRO_SMTP_SECURE",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  sendMailMock.mockClear();
  createTransportMock.mockClear();
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

async function importMailer() {
  return import("../src/mailer.js");
}

describe("isMailerConfigured", () => {
  it("is false when no SNOWPRO_SMTP_* env vars are set", async () => {
    const { isMailerConfigured } = await importMailer();
    expect(isMailerConfigured()).toBe(false);
  });

  it("is true once host/user/pass/from are all set", async () => {
    process.env.SNOWPRO_SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SNOWPRO_SMTP_USER = "user@example.com";
    process.env.SNOWPRO_SMTP_PASS = "key";
    process.env.SNOWPRO_SMTP_FROM = "noreply@example.com";
    const { isMailerConfigured } = await importMailer();
    expect(isMailerConfigured()).toBe(true);
  });

  it("is false when only some of the required vars are set", async () => {
    process.env.SNOWPRO_SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SNOWPRO_SMTP_USER = "user@example.com";
    const { isMailerConfigured } = await importMailer();
    expect(isMailerConfigured()).toBe(false);
  });
});

describe("sendPasswordResetEmail", () => {
  it("throws a clear error when SMTP isn't configured, without ever calling nodemailer", async () => {
    const { sendPasswordResetEmail } = await importMailer();
    await expect(
      sendPasswordResetEmail("alice@example.com", "https://host/reset-password?token=abc"),
    ).rejects.toThrow(/not configured/i);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("builds a transport from the SNOWPRO_SMTP_* env vars and sends the reset link in both bodies", async () => {
    process.env.SNOWPRO_SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SNOWPRO_SMTP_PORT = "587";
    process.env.SNOWPRO_SMTP_USER = "user@example.com";
    process.env.SNOWPRO_SMTP_PASS = "generated-key";
    process.env.SNOWPRO_SMTP_FROM = "noreply@example.com";
    const { sendPasswordResetEmail } = await importMailer();

    const resetUrl = "https://192.168.1.20:8080/reset-password?token=abc123";
    await sendPasswordResetEmail("alice@example.com", resetUrl);

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: { user: "user@example.com", pass: "generated-key" },
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "alice@example.com",
        text: expect.stringContaining(resetUrl),
        html: expect.stringContaining(resetUrl),
      }),
    );
  });

  it("SNOWPRO_SMTP_SECURE=true is parsed to secure: true", async () => {
    process.env.SNOWPRO_SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SNOWPRO_SMTP_USER = "user@example.com";
    process.env.SNOWPRO_SMTP_PASS = "generated-key";
    process.env.SNOWPRO_SMTP_FROM = "noreply@example.com";
    process.env.SNOWPRO_SMTP_SECURE = "true";
    const { sendPasswordResetEmail } = await importMailer();

    await sendPasswordResetEmail("alice@example.com", "https://host/reset-password?token=abc");

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });
});

// Issue #62: admin-provisioned accounts.
describe("sendAdminCreatedAccountEmail", () => {
  it("throws a clear error when SMTP isn't configured, without ever calling nodemailer", async () => {
    const { sendAdminCreatedAccountEmail } = await importMailer();
    await expect(
      sendAdminCreatedAccountEmail("alice@example.com", "Alice", "tempPass123", "https://host/"),
    ).rejects.toThrow(/not configured/i);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("sends the temp password and login link in both the text and HTML bodies", async () => {
    process.env.SNOWPRO_SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SNOWPRO_SMTP_USER = "user@example.com";
    process.env.SNOWPRO_SMTP_PASS = "generated-key";
    process.env.SNOWPRO_SMTP_FROM = "noreply@example.com";
    const { sendAdminCreatedAccountEmail } = await importMailer();

    const loginUrl = "https://192.168.1.20:8080/";
    await sendAdminCreatedAccountEmail("alice@example.com", "Alice", "correct-horse-battery-9x2", loginUrl);

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "alice@example.com",
        text: expect.stringContaining("correct-horse-battery-9x2"),
        html: expect.stringContaining("correct-horse-battery-9x2"),
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining(loginUrl), html: expect.stringContaining(loginUrl) }),
    );
    // Also greets the recipient by name, unlike the reset email (which has no name to greet with).
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Alice") }));
  });
});
