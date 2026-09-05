/**
 * Outbound email via Brevo's transactional HTTP API (`POST https://api.brevo.com/v3/smtp/email`),
 * not raw SMTP (issue #95). Originally built on `nodemailer`/generic SMTP — deliberately
 * provider-agnostic, "any SMTP relay works, switching is only an env-var change" — switched
 * because Railway (this app's primary public-hosting target, issue #85/#91) blocks all outbound
 * SMTP ports (465/587/2525) below its Pro plan tier. Confirmed live, not assumed: a real
 * password-reset attempt against the deployed instance failed with a raw SMTP connection timeout,
 * before any auth was even attempted. Brevo's API runs over plain HTTPS (port 443), which no host
 * blocks. This trades away the old "any SMTP relay" generality for self-hosters — a deliberate,
 * accepted choice (see issue #95), not an oversight.
 *
 * All config comes from `SNOWPRO_EMAIL_*` env vars, matching this repo's existing plain-env-var,
 * `SNOWPRO_`-prefixed convention (`docker-compose.yml`'s `environment:` block).
 */

interface EmailConfig {
  apiKey: string;
  from: string;
  fromName: string;
}

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/** Fallback sender display name. Brevo REJECTS a send whose sender has no name
 *  (`{"code":"missing_parameter","message":"sender name is missing"}`, HTTP 400), so this is not
 *  cosmetic -- without it every email fails, including password reset, which leaves anyone who
 *  forgets their password with no recovery path at all. */
const DEFAULT_FROM_NAME = "SnowPro Core Prep";

function readConfig(): EmailConfig | undefined {
  const apiKey = process.env.SNOWPRO_EMAIL_API_KEY;
  const from = process.env.SNOWPRO_EMAIL_FROM;
  if (!apiKey || !from) return undefined;
  // Empty-and-whitespace-checked, NOT `?? DEFAULT_FROM_NAME`. `??` only falls back on
  // null/undefined, and docker-compose.yml passes `SNOWPRO_EMAIL_FROM_NAME: ${SNOWPRO_EMAIL_FROM_NAME:-}`
  // -- which sets the variable to an EMPTY STRING when it isn't in .env, not to unset. So `??`
  // handed Brevo `name: ""` and every single send 400'd while isMailerConfigured() still reported
  // true. Confirmed from real container logs, not deduced. Same reason `!apiKey`/`!from` above use
  // `!` rather than a null check.
  const fromName = process.env.SNOWPRO_EMAIL_FROM_NAME?.trim();
  return { apiKey, from, fromName: fromName ? fromName : DEFAULT_FROM_NAME };
}

/** Whether `SNOWPRO_EMAIL_*` is fully set — lets `POST /api/password-reset/request` fail with a
 *  clear operator-facing error up front instead of a confusing mid-request throw. Safe to reveal
 *  to any caller: it's a fact about this server's global config, not about any one account, so it
 *  can't be used to enumerate users. */
export function isMailerConfigured(): boolean {
  return readConfig() !== undefined;
}

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Issue #193: where a reply should go, when that differs from the sender. Only the support
   *  form uses it -- hitting reply on a support message must reach the person who wrote it, not
   *  the support mailbox replying to itself. */
  replyTo?: { email: string; name?: string };
}

/** The one place that actually calls Brevo. `config` is always pre-validated by the caller (each
 *  exported function below does its own `readConfig()` check first) so this never has to handle
 *  "not configured" itself — only real API-call failures (bad key, Brevo-side error, network). */
async function sendViaBrevo(config: EmailConfig, message: EmailMessage): Promise<void> {
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.from, name: config.fromName },
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
      htmlContent: message.html,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API request failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
  }
}

/** Sends the forgot-password link. `resetUrl` is built by the caller from the incoming request's
 *  own origin (`req.protocol`/`req.get("host")`), not a fixed config value — see server.ts's
 *  `POST /api/password-reset/request`. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const config = readConfig();
  if (!config) {
    throw new Error("Email isn't configured (SNOWPRO_EMAIL_API_KEY/SNOWPRO_EMAIL_FROM) — call isMailerConfigured() first.");
  }
  await sendViaBrevo(config, {
    to,
    subject: "Reset your SnowPro Core Prep password",
    text:
      `A password reset was requested for this email address.\n\n` +
      `Reset your password: ${resetUrl}\n\n` +
      `This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
    html:
      `<p>A password reset was requested for this email address.</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
  });
}

/** Sent when a brand-new account self-registers via `POST /api/session` (the `!existing` branch —
 *  see server.ts). Unlike `sendAdminCreatedAccountEmail()`, there's no secret to convey here: the
 *  user already knows their own password, they just set it in the same request that created the
 *  account — this is purely an onboarding touch, not a credential-delivery mechanism, so it's
 *  fire-and-forget from the caller (same pattern as `sendPasswordResetEmail()`, not awaited/
 *  reported back to the client the way the admin-created flow's `emailSent` is, since there's
 *  nothing actionable a failure here would need to fall back to). `loginUrl` is built the same way
 *  as the other two functions' links — the live request's own origin, no fixed config value. */
export async function sendWelcomeEmail(to: string, name: string, loginUrl: string): Promise<void> {
  const config = readConfig();
  if (!config) {
    throw new Error("Email isn't configured (SNOWPRO_EMAIL_API_KEY/SNOWPRO_EMAIL_FROM) — call isMailerConfigured() first.");
  }
  await sendViaBrevo(config, {
    to,
    subject: "Welcome to SnowPro Core Prep",
    text:
      `Hi ${name},\n\n` +
      `Your SnowPro Core Prep account is ready.\n\n` +
      `Log in any time: ${loginUrl}\n\n` +
      `Domain notes, scored practice, timed mock exams, flashcards, and an adaptive study plan are ` +
      `all waiting for you — happy studying!`,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Your SnowPro Core Prep account is ready.</p>` +
      `<p><a href="${loginUrl}">Log in any time</a></p>` +
      `<p>Domain notes, scored practice, timed mock exams, flashcards, and an adaptive study plan ` +
      `are all waiting for you — happy studying!</p>`,
  });
}

/** Issue #62: sent when an admin provisions a new account via `POST /api/admin/users`. Unlike
 *  `sendPasswordResetEmail()`, the secret here IS the password itself, not a link to set one --
 *  the admin explicitly chose a temporary-password flow, so the new user logs in with it directly
 *  and is forced into a "set a real password" step immediately (`must_change_password`, see
 *  db.ts's `completeMustChangePassword()`). `loginUrl` is built by the caller the same way
 *  `sendPasswordResetEmail()`'s `resetUrl` is (`req.protocol`/`req.get("host")`, no fixed
 *  public-URL config) -- just the app's root, not a token-bearing link, since there's nothing to
 *  prove here that the temp password itself doesn't already prove. Throws the same way
 *  `sendPasswordResetEmail()` does if email isn't configured -- `POST /api/admin/users` catches
 *  that itself and still reports the temp password back to the admin as a manual fallback, so this
 *  failing is never a dead end. */
export async function sendAdminCreatedAccountEmail(
  to: string,
  name: string,
  tempPassword: string,
  loginUrl: string,
): Promise<void> {
  const config = readConfig();
  if (!config) {
    throw new Error("Email isn't configured (SNOWPRO_EMAIL_API_KEY/SNOWPRO_EMAIL_FROM) — call isMailerConfigured() first.");
  }
  await sendViaBrevo(config, {
    to,
    subject: "Your SnowPro Core Prep account",
    text:
      `Hi ${name},\n\n` +
      `An account was created for you on SnowPro Core Prep.\n\n` +
      `Log in: ${loginUrl}\n` +
      `Email: ${to}\n` +
      `Temporary password: ${tempPassword}\n\n` +
      `You'll be asked to set your own password right away.`,
    html:
      `<p>Hi ${name},</p>` +
      `<p>An account was created for you on SnowPro Core Prep.</p>` +
      `<p><a href="${loginUrl}">Log in</a></p>` +
      `<p>Email: <strong>${to}</strong><br>Temporary password: <strong>${tempPassword}</strong></p>` +
      `<p>You'll be asked to set your own password right away.</p>`,
  });
}

/** Where support messages are delivered (issue #193).
 *
 *  `SNOWPRO_SUPPORT_EMAIL`, falling back to `SNOWPRO_LEGAL_CONTACT` — which is already the address
 *  published on /privacy/, /about/, /security/ and in security.txt, so the common case needs no new
 *  configuration and cannot drift from the address users are told to write to. The separate
 *  variable exists for the deployment that wants support routed somewhere other than its legal
 *  contact.
 *
 *  `undefined` when neither is set, and `POST /api/support` then 404s rather than advertising a
 *  feature it cannot deliver — the same rule the legal pages follow. */
export function supportRecipient(): string | undefined {
  const explicit = process.env.SNOWPRO_SUPPORT_EMAIL?.trim();
  if (explicit) return explicit;
  const legal = process.env.SNOWPRO_LEGAL_CONTACT?.trim();
  return legal ? legal : undefined;
}

/** Delivers a support message to the operator (issue #193).
 *
 *  THE RECIPIENT IS NEVER TAKEN FROM THE REQUEST. It comes from `supportRecipient()` above, and
 *  that is the single property keeping this endpoint from being an open spam relay: a caller can
 *  choose what the message says, never who receives it. The sender's own address rides in
 *  `replyTo` instead, so replying reaches them without ever letting them address mail through this
 *  server.
 *
 *  `fromEmail`/`fromName` are untrusted user input. They go into the body and the Reply-To only --
 *  never into the subject, and never into a header this function constructs by concatenation. */
export async function sendSupportMessage(args: {
  to: string;
  fromEmail: string;
  fromName: string;
  message: string;
  context: string[];
}): Promise<void> {
  const config = readConfig();
  if (!config) {
    throw new Error("Email isn't configured (SNOWPRO_EMAIL_API_KEY/SNOWPRO_EMAIL_FROM) — call isMailerConfigured() first.");
  }

  const contextLines = args.context.length > 0 ? args.context : ["(none)"];
  const text = [
    `From: ${args.fromName} <${args.fromEmail}>`,
    "",
    args.message,
    "",
    "---",
    ...contextLines,
  ].join("\n");

  const html = [
    `<p><strong>From:</strong> ${escapeHtml(args.fromName)} &lt;${escapeHtml(args.fromEmail)}&gt;</p>`,
    `<div style="white-space:pre-wrap">${escapeHtml(args.message)}</div>`,
    "<hr>",
    `<p style="color:#666;font-size:12px">${contextLines.map(escapeHtml).join("<br>")}</p>`,
  ].join("\n");

  await sendViaBrevo(config, {
    to: args.to,
    // Fixed subject. The user's own words are the body -- putting them in the subject would let a
    // newline in the input attempt header injection, and would also make threading unpredictable.
    subject: "SnowPro Core Prep — support request",
    text,
    html,
    replyTo: { email: args.fromEmail, name: args.fromName },
  });
}

/** Minimal HTML escaping for user-supplied text going into an email body. The mail templates above
 *  interpolate only values this codebase produced; this function exists for the support message,
 *  which is the one place a stranger's text reaches an HTML email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
