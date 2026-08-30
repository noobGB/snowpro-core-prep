/**
 * Outbound email for issue #59's forgot-password flow — this app's first email-sending capability
 * (see `pipeline/src/server.ts`'s `POST /api/password-reset/request`, and `CLAUDE.md`'s "Password
 * login" section for why one didn't exist before). Generic SMTP via `nodemailer` rather than a
 * specific provider's SDK: any SMTP relay works (initial deployment targets Brevo's free relay,
 * `smtp-relay.brevo.com:587`, chosen because it lets you verify a single sender address instead of
 * a whole domain — this app has neither), and switching providers later is only an env-var change.
 *
 * All config comes from `SNOWPRO_SMTP_*` env vars, matching this repo's existing plain-env-var,
 * `SNOWPRO_`-prefixed convention (`docker-compose.yml`'s `environment:` block) — there's no
 * `.env.example`-driven default because a real SMTP account is inherently operator-specific.
 */

import nodemailer, { type Transporter } from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

function readConfig(): SmtpConfig | undefined {
  const host = process.env.SNOWPRO_SMTP_HOST;
  const user = process.env.SNOWPRO_SMTP_USER;
  const pass = process.env.SNOWPRO_SMTP_PASS;
  const from = process.env.SNOWPRO_SMTP_FROM;
  if (!host || !user || !pass || !from) return undefined;
  return {
    host,
    user,
    pass,
    from,
    port: Number(process.env.SNOWPRO_SMTP_PORT ?? 587),
    secure: process.env.SNOWPRO_SMTP_SECURE === "true",
  };
}

/** Whether `SNOWPRO_SMTP_*` is fully set — lets `POST /api/password-reset/request` fail with a
 *  clear operator-facing error up front instead of a confusing mid-request `sendMail()` throw. Safe
 *  to reveal to any caller: it's a fact about this server's global config, not about any one
 *  account, so it can't be used to enumerate users. */
export function isMailerConfigured(): boolean {
  return readConfig() !== undefined;
}

let transporter: Transporter | undefined;

/** Built lazily (not at module load) so a server boot with no SMTP configured yet — the common case
 *  until an operator sets it up — never throws just from importing this module. */
function getTransporter(): Transporter {
  if (transporter) return transporter;
  const config = readConfig();
  if (!config) {
    throw new Error("SMTP is not configured (SNOWPRO_SMTP_HOST/USER/PASS/FROM) — call isMailerConfigured() first.");
  }
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  return transporter;
}

/** Sends the forgot-password link. `resetUrl` is built by the caller from the incoming request's
 *  own origin (`req.protocol`/`req.get("host")`), not a fixed config value — see server.ts's
 *  `POST /api/password-reset/request`. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const config = readConfig();
  if (!config) {
    throw new Error("SMTP is not configured (SNOWPRO_SMTP_HOST/USER/PASS/FROM) — call isMailerConfigured() first.");
  }
  await getTransporter().sendMail({
    from: config.from,
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
