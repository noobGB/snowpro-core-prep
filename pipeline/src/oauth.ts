/**
 * Google OAuth 2.0 login (issue #113) — Authorization Code flow, implemented directly against
 * Google's HTTP endpoints via native `fetch` rather than a library (`passport`/`openid-client`/
 * `jose`), matching this codebase's existing style of calling `node:crypto`/`fetch` directly for
 * auth/HTTP concerns (see `passwords.ts`, `mailer.ts`) rather than adding a dependency for
 * something two or three HTTP calls already cover.
 *
 * Identity-token verification calls Google's own `tokeninfo` endpoint rather than verifying the
 * JWT signature locally against Google's JWKS — trades a small amount of per-login latency and a
 * runtime dependency on that endpoint's uptime for zero new dependencies (no JWT/JWKS library).
 * Revisit if this app ever needs to shed that extra round trip.
 *
 * All config comes from `SNOWPRO_GOOGLE_*` env vars, matching `mailer.ts`'s `SNOWPRO_EMAIL_*`
 * pattern — unset means the feature is absent (server.ts's routes 404), not a boot-time failure.
 *
 * "New user vs. existing user" is NOT decided anywhere in this file — Google's tokeninfo response
 * only proves "this real person, verified, has this email and this permanent sub." Matching that
 * identity against this app's own `users` table (db.ts's `findUserByGoogleSub`/`findUserByEmail`)
 * is entirely server.ts's job, the same way it already is for password login.
 */

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
}

function readConfig(): OAuthConfig | undefined {
  const clientId = process.env.SNOWPRO_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.SNOWPRO_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

/** Whether `SNOWPRO_GOOGLE_*` is fully set — lets server.ts's two routes 404 cleanly instead of
 *  crashing mid-request when this feature just isn't configured for a given deployment (matches
 *  `mailer.ts`'s `isMailerConfigured()` pattern exactly). Safe to reveal to any caller: a fact
 *  about this server's global config, not about any one account. */
export function isGoogleOAuthConfigured(): boolean {
  return readConfig() !== undefined;
}

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/** Builds the URL to redirect the browser to for step 1 of the flow (`server.ts`'s
 *  `GET /api/oauth/google/start`). `redirectUri` must exactly match one of the URIs registered for
 *  this client in Google Cloud Console. `state` is the caller's CSRF token — generated and
 *  cookie-stashed by the caller, not this module, since this module has no cookie/session concept
 *  of its own. Throws if not configured; the caller checks `isGoogleOAuthConfigured()` first and
 *  404s instead of ever reaching this. */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const config = readConfig();
  if (!config) {
    throw new Error("Google OAuth isn't configured (SNOWPRO_GOOGLE_CLIENT_ID/SNOWPRO_GOOGLE_CLIENT_SECRET).");
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

/** Steps 5-7 of the flow: exchanges the authorization `code` for tokens (a server-to-server POST,
 *  never visible to the browser), then verifies the returned `id_token` via Google's own
 *  `tokeninfo` endpoint (rather than local JWT/JWKS verification — see this file's header comment)
 *  and returns the verified identity claims. Throws on any failure — a bad/expired code, a network
 *  error, an `aud` mismatch (the token wasn't actually issued for this app's client ID), or
 *  (deliberately) an unverified email, since this app trusts email as its unique identity key and
 *  must never create/link an account against an email Google itself hasn't confirmed. */
export async function exchangeCodeForIdentity(code: string, redirectUri: string): Promise<GoogleIdentity> {
  const config = readConfig();
  if (!config) {
    throw new Error("Google OAuth isn't configured (SNOWPRO_GOOGLE_CLIENT_ID/SNOWPRO_GOOGLE_CLIENT_SECRET).");
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${tokenRes.statusText}${body ? ` — ${body}` : ""}`);
  }
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) throw new Error("Google token exchange response had no id_token.");

  const infoRes = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!infoRes.ok) {
    const body = await infoRes.text().catch(() => "");
    throw new Error(`Google tokeninfo verification failed: ${infoRes.status} ${infoRes.statusText}${body ? ` — ${body}` : ""}`);
  }
  const claims = (await infoRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: string;
    name?: string;
    aud?: string;
  };

  if (claims.aud !== config.clientId) {
    throw new Error("Google id_token 'aud' claim doesn't match this app's client ID -- refusing to trust it.");
  }
  if (!claims.sub || !claims.email) {
    throw new Error("Google id_token is missing sub/email claims.");
  }
  if (claims.email_verified !== "true") {
    throw new Error(`Google reports email "${claims.email}" as unverified -- refusing to trust it as an identity.`);
  }

  return { sub: claims.sub, email: claims.email, name: claims.name ?? claims.email };
}

export type GoogleAccountLinkDecision = "create" | "link" | "refuse";

/** Pure decision logic for what `GET /api/oauth/google/callback` (server.ts) should do once a
 *  verified Google identity has no matching `google_sub` row yet, but a lookup by email might
 *  still find an existing account. Extracted out of that route (which has no test harness -- this
 *  repo has no supertest-equivalent, see oauth.spec.ts's own header comment) specifically so this
 *  one branch -- the actual security-critical decision -- has real, fast unit coverage rather than
 *  "verified live" being the only claim behind it.
 *
 *  Security (issue #129): self-registration (POST /api/session's `!existing` branch) creates an
 *  account for any email string with zero ownership proof, so an attacker can pre-register
 *  someone else's email with an attacker-chosen password before the real owner ever tries Google
 *  sign-in. Auto-linking a freshly-verified Google identity into that row would hand the attacker's
 *  account to the real owner's session -- so only a passwordless existing row (a legacy pre-#46
 *  account, or one already created by an earlier Google-only signup) is safe to auto-link; a row
 *  that already has a password is refused, forcing the real owner through the password/
 *  forgot-password path instead, which actually proves ownership of that email/password first. */
export function resolveGoogleAccountLink(existingByEmail: { passwordHash: string | null } | undefined): GoogleAccountLinkDecision {
  if (!existingByEmail) return "create";
  if (existingByEmail.passwordHash !== null) return "refuse";
  return "link";
}
