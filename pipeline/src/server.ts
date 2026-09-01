/**
 * The container's entry point (spec §9): verify /data is writable, run the content pipeline
 * against /content before binding (the loud-failure rule from §5 applies at boot — a broken
 * source file must stop the container, never serve stale or partial content), then serve the
 * built frontend + generated JSON + the two progress routes on one port.
 *
 * Pipeline output goes to its own directory (SNOWPRO_DIST_DIR's sibling, not SNOWPRO_DIST_DIR
 * itself) deliberately: write/output.ts's writer deletes and replaces its entire output
 * directory on every run. Pointed at the built frontend's own directory, the first successful
 * boot would delete index.html and the built JS/CSS along with it. Serving both directories at
 * the same URL root (see the static mounts below) gets the spec's "one /app/dist" behavior from
 * the browser's point of view without that risk.
 */

import express from "express";
import path from "node:path";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolveConfig } from "./config.js";
import { runPipeline } from "./index.js";
import { writeOutput } from "./write/output.js";
import { printFailure, printNotices, printSuccess } from "./report.js";
import {
  completeMustChangePassword,
  completePasswordReset,
  countAdmins,
  createPasswordResetToken,
  createSession,
  createUserByAdmin,
  deleteSession,
  deleteUser,
  findUserByEmail,
  findUserByGoogleSub,
  findUserById,
  getProgressRow,
  linkGoogleAccount,
  listAllUsers,
  migrateFlatFileProgress,
  normalizeEmail,
  openDb,
  resolveSession,
  setPassword,
  setPasswordIfUnset,
  setUserRole,
  upsertUserOnLogin,
  usersCount,
  writeProgressRow,
  ProgressConflictError,
  type Db,
  type UserRole,
  type UserRow,
} from "./db.js";
import { hashPassword, verifyPassword, generateTemporaryPassword, MIN_PASSWORD_LENGTH } from "./passwords.js";
import { isMailerConfigured, sendAdminCreatedAccountEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./mailer.js";
import { buildAuthUrl, exchangeCodeForIdentity, isGoogleOAuthConfigured, resolveGoogleAccountLink } from "./oauth.js";
import { createLoginLockout } from "./loginLockout.js";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = path.resolve(process.env.SNOWPRO_DATA_DIR ?? "/data");
const DIST_DIR = path.resolve(process.env.SNOWPRO_DIST_DIR ?? "/app/dist");
// The pre-upgrade single-user flat file — no longer read/written directly (see db.ts's
// migrateFlatFileProgress()), but still checked for once, on the very first ever login after this
// upgrade, to import whatever progress it holds rather than silently discarding it.
const OLD_PROGRESS_FILE = path.join(DATA_DIR, "progress.json");
const DB_FILE = path.join(DATA_DIR, "snowprep.sqlite");
const PROBE_FILE = path.join(DATA_DIR, ".snowprep-write-probe");
const SESSION_COOKIE = "snowprep_session";
// 400 days is Chrome's own hard cap on Set-Cookie Max-Age (a longer value gets silently clamped
// to this) — used here deliberately as a long-lived "remember this device" cookie, matching the
// no-password design's whole point: logging in once shouldn't need repeating every browser restart.
const SESSION_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

/** Must match app/src/lib/progress.ts's defaultState() shape exactly — the two sides of the
 *  GET /api/progress contract have to agree byte-for-byte on what "empty" looks like. */
function defaultProgressState() {
  return {
    schemaVersion: 1,
    examDate: null,
    lastLocation: null,
    attempts: [],
    inProgress: null,
    flashcards: { seen: [], lastIndex: 0 },
    plan: { checked: [] },
    setup: { checked: [] },
    settings: { theme: "dark" },
  };
}

/** Spec §8 risk: "a container user that cannot write /data turns every save into a silent
 *  no-op... refuses to start if it fails." Runs before the pipeline so a permissions problem
 *  fails in milliseconds, not after a multi-second parse. */
function verifyDataDirWritable(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(PROBE_FILE, `${new Date().toISOString()}\n`, "utf8");
    readFileSync(PROBE_FILE, "utf8");
    rmSync(PROBE_FILE, { force: true });
    console.log(`✓ /data is writable (${DATA_DIR})`);
  } catch (err) {
    console.error(`\n✗ Cannot write to the data directory — refusing to start.`);
    console.error(`  data dir: ${DATA_DIR}`);
    console.error(`  probe file: ${PROBE_FILE}`);
    console.error(`  error: ${err instanceof Error ? err.message : String(err)}`);
    console.error(
      "  This is usually a volume-permissions problem: the container's user can't write the " +
        'mounted /data folder. Check the host folder\'s ownership, or the "user:" field in docker-compose.yml.\n',
    );
    process.exit(1);
  }
}

/** Runs the content pipeline against /content. Fails loudly and exits — never serves stale or
 *  partial content — matching spec §5's rule applied at boot, per spec §9. */
function bootPipeline() {
  const config = resolveConfig();
  let result;
  try {
    result = runPipeline(config);
  } catch (err) {
    console.error(`\n✗ Content pipeline crashed before producing a report.`);
    console.error(`  source dir: ${config.sourceDir}`);
    console.error(`  error: ${err instanceof Error ? err.message : String(err)}`);
    console.error("  This usually means the /content volume isn't mounted, or is empty.\n");
    process.exit(1);
  }

  printNotices(result.notices);
  if (!result.success) {
    printFailure(result.collector);
    console.error("✗ Server not starting — fix the source files above and restart the container.\n");
    process.exit(1);
  }

  writeOutput(config.outputDir, result.bundle!, result.notesByDomain!, result.searchIndex!);
  printSuccess(result.bundle!, result.stats!, config.outputDir);
  return config;
}

verifyDataDirWritable();
const config = bootPipeline();
const db: Db = openDb(DB_FILE);
console.log(`✓ Identity/progress database ready (${DB_FILE})`);

const app = express();

// Railway (and any TLS-terminating reverse proxy) forwards plain HTTP internally with
// X-Forwarded-Proto/X-Forwarded-For set. Trust exactly one hop so req.protocol/req.secure reflect
// the real public scheme instead of always reporting plain HTTP. Inert for the local LAN
// deployment: there's no reverse proxy in front of it (docker-compose's 8080:8080 port mapping
// goes straight to this process), so no X-Forwarded-* header is ever present on real LAN traffic
// and req.protocol keeps resolving from the raw socket exactly as before.
app.set("trust proxy", 1);

// --- Security: baseline HTTP response headers, previously entirely absent (no CSP, no clickjacking
//     protection, nothing). Hand-rolled rather than adding `helmet` -- five headers, matching this
//     codebase's existing "native APIs over a new dependency" style (oauth.ts/passwords.ts).
//     script-src still needs 'unsafe-inline' for index.html's one pre-paint theme-sync script (see
//     that file's own comment on why it has to run synchronously before the bundle loads, so it
//     can't be moved into a same-origin external file the normal way) -- hash-pinning that one
//     script instead was considered, but the file has no server-side templating (a documented,
//     deliberate gap -- see the same comment) to inject a per-request nonce, and a static hash goes
//     silently stale the moment anyone edits that script without remembering to recompute it. Every
//     *other* directive here is as strict as this app's actual resource use allows (Google Fonts is
//     the only external origin loaded anywhere) -- this is a real, if incomplete, improvement over
//     having no CSP at all, not a no-op. ---
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  res.setHeader("X-Frame-Options", "DENY"); // redundant with frame-ancestors on modern browsers, kept for older ones
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // HSTS is meaningless (and browsers ignore it) over plain HTTP, so this is correctly inert for
  // the LAN/localhost deployment and only takes effect for the real HTTPS Railway one -- same
  // req.secure signal the session cookie's own Secure flag already relies on.
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
});

// --- Identity: POST /api/session, GET /api/me, POST /api/logout, POST /api/account/password[-setup],
//     POST /api/password-reset/[request|confirm]. Email is the sole identity/lookup key (case/
//     whitespace-normalized, see db.ts's normalizeEmail()), name is display-only and never used for
//     lookups. Password is required for every account as of issue #46 (a legacy pre-#46 account
//     claims one via the "needs_password_setup" state below). Issue #59 added a real self-service
//     reset (emailed link via SNOWPRO_EMAIL_* / mailer.ts) — the operator manually clearing
//     password_hash back to NULL is still available as a fallback for an account with no email
//     access at all, but is no longer the only path. Sessions are a random token in an HTTP-only
//     cookie (SameSite=Lax, Secure iff req.secure — see issueSessionCookie()). ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getCookie(req: express.Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

function currentUser(req: express.Request): UserRow | undefined {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return undefined;
  return resolveSession(db, token);
}

/** Guards GET/PUT /api/progress — both require a valid session now, unlike the old flat-file
 *  routes (which had no identity concept at all to check). */
function requireSession(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in. POST /api/session with an email first." });
    return;
  }
  (res.locals as { user: UserRow }).user = user;
  next();
}

/** Guards every `/api/admin/*` route (issue #62) — chained after `requireSession`, which is what
 *  actually resolves `res.locals.user`. This is the real enforcement; the frontend hiding the
 *  Admin nav link and redirecting non-admins off `/admin` (`Admin.tsx`) is UX only, never trusted
 *  on its own. */
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const user = (res.locals as { user: UserRow }).user;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

/** The origin every emailed link (password reset, admin-added-user login link) is built against.
 *
 *  Issue #70: deliberately always the live incoming request's own `Host` header — recomputed fresh
 *  on every single email, nothing stored or guessed anywhere. Issue #68 tried auto-detecting a
 *  "stable" host name instead (Windows `COMPUTERNAME`, Mac/Linux `HOSTNAME`), on the theory that a
 *  raw LAN IP is fragile (changes on DHCP renewal/reboot) and a hostname would survive that. Real
 *  device testing found the opposite: the bare NetBIOS name never resolves from a phone at all
 *  (phones don't speak NetBIOS), and `<name>.local` (mDNS) also failed on a real phone/router/
 *  Windows combination even after fixing the most common cause (network profile set to Private) —
 *  mDNS has too many independent failure points (third-party firewalls, router/AP multicast
 *  handling) to rely on. A pinned/static IP works reliably but was explicitly rejected: it removes
 *  the portability of just running this container on whatever network/host it happens to be on.
 *  The live request's own address is the one thing that's simultaneously portable (recomputed
 *  fresh every time, adapts instantly to a new network with zero config) *and* actually reaches a
 *  phone — because it's exactly the raw IP address the admin is already proven to be reachable on
 *  right now, this exact moment.
 *
 *  The one gap this doesn't close on its own: if the admin is on `localhost` when they trigger an
 *  email, that address is useless to anyone else. `Admin.tsx` warns visibly when the current
 *  session is on `localhost`, since that's the one case worth catching client-side rather than
 *  silently baking a broken link into an email. `SNOWPRO_HOST_NAME` remains available as a fully
 *  optional, manual, opt-in override for anyone who wants to force a specific value later — never
 *  automatic, never guessed.
 *
 *  Scheme is `req.protocol`, not hardcoded — this app doesn't terminate TLS itself, but may run
 *  behind a TLS-terminating reverse proxy (e.g. a cloud host), in which case `app.set("trust
 *  proxy", 1)` above makes `req.protocol` reflect the real public scheme via `X-Forwarded-Proto`.
 *  On the local LAN deployment there's no such proxy, so this still just resolves to `http`.
 *
 *  Issue #97: the `hostOverride` branch's `:${PORT}` append is correct ONLY for plain-HTTP LAN
 *  use — confirmed as a real, live bug, not theoretical: with `SNOWPRO_HOST_NAME` set on Railway,
 *  emailed reset links read `https://<domain>:8080/...`, and nothing on Railway's public HTTPS
 *  edge listens on 8080 (that's the *internal* container port), so every such link timed out.
 *  `PORT` is meaningful only on the plain-HTTP LAN path, where a client really does need the
 *  non-standard port in the address to reach the server directly with no reverse proxy in front.
 *  Behind a real TLS-terminating edge the public entry point is always the implicit standard port
 *  for the scheme (443) — the internal `PORT` value must never leak into a public-facing URL. */
function publicOrigin(req: express.Request): string {
  const hostOverride = process.env.SNOWPRO_HOST_NAME;
  if (hostOverride) return req.protocol === "https" ? `https://${hostOverride}` : `${req.protocol}://${hostOverride}:${PORT}`;
  return `${req.protocol}://${req.get("host")}`;
}

function issueSessionCookie(req: express.Request, res: express.Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  });
}

// Issue #46 brute-force guard / issue #131's unbounded-lockout fix -- see loginLockout.ts's own
// header comment for the full reasoning, extracted there so its cap behavior has real unit tests.
const { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt } = createLoginLockout();

app.post("/api/session", express.json({ limit: "10kb" }), (req, res) => {
  const body = req.body as
    | { email?: unknown; name?: unknown; password?: unknown; newPassword?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const rawName = typeof body?.name === "string" ? body.name.trim() : "";
  // Absent/blank name means "just log me back in" (issue #41: don't re-ask for a name the server
  // already has) — distinct from an empty string, which would otherwise mean "erase the name."
  const name = rawName.length > 0 ? rawName : undefined;
  const password = typeof body?.password === "string" ? body.password : undefined;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : undefined;

  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  if (name !== undefined && name.length > 100) {
    res.status(400).json({ error: "Name must be 100 characters or fewer." });
    return;
  }
  if ((password !== undefined && password.length > 200) || (newPassword !== undefined && newPassword.length > 200)) {
    res.status(400).json({ error: "Password must be 200 characters or fewer." });
    return;
  }

  const existing = findUserByEmail(db, email);

  if (!existing) {
    // Issue #46: a brand new account needs a name AND a password together, in the same submit —
    // there's no legacy-migration issue for an account that doesn't exist yet, so no exemption.
    // Checked BEFORE creating the account: this whole handler is synchronous (no `await` anywhere
    // in this call chain, including every db.ts call), so nothing else can interleave between
    // this read and upsertUserOnLogin()'s write below — Node's single-threaded event loop only
    // picks up the next request once this handler returns.
    if (name === undefined || password === undefined) {
      res.json({ status: "new" });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    const isFirstEverAccount = usersCount(db) === 0;
    // Issue #62: the very first account on a fresh database becomes admin automatically -- the
    // live-database equivalent (a pre-existing account with no admin yet) is handled once, at boot,
    // by db.ts's addRoleColumnIfMissing() migration, not here.
    const user = upsertUserOnLogin(db, email, name, hashPassword(password), isFirstEverAccount ? "admin" : "user");
    if (isFirstEverAccount) {
      const migrated = migrateFlatFileProgress(db, user.id, OLD_PROGRESS_FILE);
      if (migrated) console.log(`✓ Migrated pre-upgrade progress.json into ${user.email}'s new account`);
    }
    // Fire-and-forget, same pattern as the password-reset email below — no secret to convey, no
    // reason to make the response wait on an SMTP round trip or to report delivery back to the
    // client.
    if (isMailerConfigured()) {
      sendWelcomeEmail(user.email, user.name, `${publicOrigin(req)}/`).catch((err: unknown) => {
        console.error(`Failed to send welcome email to ${user.email}:`, err);
      });
    }
    issueSessionCookie(req, res, createSession(db, user.id));
    res.json({ status: "known", email: user.email, name: user.name });
    return;
  }

  // A legacy (pre-issue-#46) account that hasn't claimed a password yet. See db.ts's
  // setPasswordIfUnset() for why the claim itself, not a preceding check, is the race guard —
  // whoever's UPDATE actually commits first wins, which is the same trust level this app already
  // had (whoever knows the email had full access), just closing the door going forward.
  if (existing.passwordHash === null) {
    if (newPassword === undefined) {
      res.json({ status: "needs_password_setup" });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    const claimed = setPasswordIfUnset(db, existing.id, hashPassword(newPassword));
    if (!claimed) {
      // Someone else's claim committed first (vanishingly rare, but must not be silently
      // overridden) — this submitter must log in with whatever password just got set instead.
      res.json({ status: "needs_password" });
      return;
    }
    issueSessionCookie(req, res, createSession(db, existing.id));
    res.json({ status: "known", email: existing.email, name: existing.name });
    return;
  }

  // Issue #62: an admin-provisioned account (real temp password already set, unlike the legacy
  // null-hash branch above) that hasn't completed its forced first-login password change yet.
  // Same two-round-trip shape as the claim flow above: `password` here is the TEMP password being
  // verified, `newPassword` is the real one replacing it — LoginOptions' existing fields, reused
  // as-is, no new wire shape needed.
  if (existing.mustChangePassword) {
    if (newPassword === undefined) {
      res.json({ status: "must_change_password" });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    const lockedForSeconds = checkRateLimit(email);
    if (lockedForSeconds !== undefined) {
      res.status(429).json({ error: `Too many attempts. Try again in ${lockedForSeconds}s.` });
      return;
    }
    if (password === undefined || !verifyPassword(password, existing.passwordHash)) {
      recordFailedAttempt(email);
      res.status(401).json({ error: "That temporary password doesn't match." });
      return;
    }
    recordSuccessfulAttempt(email);
    const changed = completeMustChangePassword(db, existing.id, hashPassword(newPassword));
    if (!changed) {
      // Already completed by a concurrent request (vanishingly rare, same reasoning as the claim
      // flow's race handling above) — this submitter must log in normally with the new password.
      res.json({ status: "needs_password" });
      return;
    }
    issueSessionCookie(req, res, createSession(db, existing.id));
    res.json({ status: "known", email: existing.email, name: existing.name });
    return;
  }

  // Normal password-required login.
  if (password === undefined) {
    res.json({ status: "needs_password" });
    return;
  }
  const lockedForSeconds = checkRateLimit(email);
  if (lockedForSeconds !== undefined) {
    res.status(429).json({ error: `Too many attempts. Try again in ${lockedForSeconds}s.` });
    return;
  }
  if (!verifyPassword(password, existing.passwordHash)) {
    recordFailedAttempt(email);
    res.status(401).json({ error: "That password doesn't match this email." });
    return;
  }
  recordSuccessfulAttempt(email);
  issueSessionCookie(req, res, createSession(db, existing.id));
  res.json({ status: "known", email: existing.email, name: existing.name });
});

// --- Issue #113: Google OAuth login, an additional way in alongside the password flow above --
//     existing accounts/passwords are completely untouched. See oauth.ts's header comment for the
//     full step-by-step mechanism; this pair of routes is steps 1-2 (start) and 4-9 (callback) of
//     that flow. `redirectUri` is recomputed from the live request the same way publicOrigin()'s
//     other callers do (issue #70's reasoning applies identically here) — it must match, byte for
//     byte, one of the URIs registered for this OAuth client in Google Cloud Console. ---
const OAUTH_STATE_COOKIE = "snowprep_oauth_state";
const GOOGLE_CALLBACK_PATH = "/api/oauth/google/callback";

/** Whether `host` (already port-stripped, e.g. `req.hostname`) is an RFC 1918 private-use IPv4
 *  address (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) -- discovered live, not from Google's
 *  docs first: a real LAN client hit "Access blocked: Authorization Error ... device_id and
 *  device_name are required for private IP" (Google's error, verbatim) when it reached
 *  `/api/oauth/google/start` via `http://192.168.1.8:8080`. Google's OAuth authorization server
 *  rejects a `redirect_uri` whose host is a private-use IP under the standard web-app
 *  Authorization Code flow entirely -- it wants the device/limited-input-device grant type
 *  instead (a different flow this app has no reason to implement), no matter how correctly
 *  `SNOWPRO_GOOGLE_CLIENT_ID`/`SECRET` are configured. `localhost`/`127.0.0.1`/`::1` are
 *  deliberately exempted -- Google documents `localhost` as an explicit exception, confirmed
 *  working directly (Gaurav's own local test, before this was even discovered as an issue). */
function isPrivateNetworkHost(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  return /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

/** Lets LoginGate.tsx hide the "Continue with Google" button entirely -- until this deployment
 *  actually has SNOWPRO_GOOGLE_* configured (rather than showing a button that 404s on click), and
 *  also whenever the *current request itself* is arriving over a private-network LAN address
 *  (rather than showing a button that Google itself will always reject, see
 *  isPrivateNetworkHost()'s comment) -- unlike the config check, this one is necessarily
 *  per-request, since the same server serves both LAN clients and the public domain/localhost.
 *  Deliberately unauthenticated (same reasoning as isMailerConfigured()'s own exposure, mailer.ts)
 *  -- a fact about this request/server, not about any one account. */
app.get("/api/oauth/google/available", (req, res) => {
  res.json({ available: isGoogleOAuthConfigured() && !isPrivateNetworkHost(req.hostname) });
});

app.get("/api/oauth/google/start", (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    res.status(404).json({ error: "Google sign-in isn't configured on this server." });
    return;
  }
  if (isPrivateNetworkHost(req.hostname)) {
    res.status(400).json({
      error:
        "Google sign-in isn't available over a local network address -- Google's OAuth policy only " +
        "allows this for a public domain or localhost. Use email/password instead, or access this " +
        "app via localhost.",
    });
    return;
  }
  // CSRF protection (mechanism described in oauth.ts's header comment, step 2/5): a random value
  // we generate now, stash in a short-lived cookie, and must see echoed back unchanged on the
  // callback -- proves the callback we're about to act on really corresponds to a flow we just
  // initiated, not one an attacker tricked the browser into starting elsewhere.
  const state = randomBytes(32).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/", maxAge: 10 * 60 * 1000 });
  res.redirect(buildAuthUrl(`${publicOrigin(req)}${GOOGLE_CALLBACK_PATH}`, state));
});

app.get("/api/oauth/google/callback", async (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    res.status(404).json({ error: "Google sign-in isn't configured on this server." });
    return;
  }
  const expectedState = getCookie(req, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
  const { code, state } = req.query;
  if (typeof code !== "string" || typeof state !== "string" || !expectedState || state !== expectedState) {
    res.status(400).send("Google sign-in failed: missing or mismatched state. Please try again.");
    return;
  }

  let identity;
  try {
    identity = await exchangeCodeForIdentity(code, `${publicOrigin(req)}${GOOGLE_CALLBACK_PATH}`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    res.status(400).send("Google sign-in failed. Please try again.");
    return;
  }

  // "New user or existing user" is decided here, entirely by our own lookups against our own
  // users table -- Google's response above proves identity, nothing about our database (see
  // oauth.ts's header comment for the full reasoning). Same findUserByEmail() this app's password
  // login already uses; the only new step is the google_sub fast-path lookup first.
  let user = findUserByGoogleSub(db, identity.sub);
  if (!user) {
    const existingByEmail = findUserByEmail(db, identity.email);
    // Security (issue #129): see resolveGoogleAccountLink()'s own doc comment (oauth.ts) for the
    // full reasoning -- an unverified self-registered account with a password set is refused here
    // rather than silently taken over by whoever later proves Google ownership of that email.
    const decision = resolveGoogleAccountLink(existingByEmail);
    if (decision === "refuse") {
      res
        .status(409)
        .send(
          "An account already exists for this email with a password set. Sign in with that " +
            "password instead (use “Forgot password?” if you don't know it) -- once " +
            "signed in, Google sign-in can be added from Settings.",
        );
      return;
    }
    if (decision === "link" && existingByEmail) {
      linkGoogleAccount(db, existingByEmail.id, identity.sub);
      user = existingByEmail;
    } else {
      const isFirstEverAccount = usersCount(db) === 0;
      // Same first-user-becomes-admin rule as the password-signup path above (issue #62) --
      // passwordHash omitted (stays NULL), exactly the existing "no local password" shape
      // SettingsPanel/LoginGate already handle for legacy accounts (see the plan's design notes).
      // A `const` here (not reassigning the outer `let user` directly) deliberately, matching how
      // the password-signup route above does this -- TypeScript can't narrow a mutable `let`
      // inside the sendWelcomeEmail().catch() closure below, since the closure could in principle
      // run after a later reassignment; a `const` has no such ambiguity.
      let newUser;
      try {
        newUser = upsertUserOnLogin(db, identity.email, identity.name, undefined, isFirstEverAccount ? "admin" : "user");
      } catch (err) {
        // Race: two concurrent first-time Google logins for the same brand-new email (double
        // click, two tabs) can both pass the findUserByEmail() check above before either INSERT
        // commits -- users.email's UNIQUE constraint (db.ts) throws for the loser. Unlike
        // POST /api/session (fully synchronous, so this can't happen there -- see that route's own
        // comment), this handler already awaited two Google HTTP calls first, leaving a real
        // window open. Re-look-up and link instead of surfacing a raw 500, same recovery shape as
        // setPasswordIfUnset()'s own race guard elsewhere in this file.
        const winner = findUserByEmail(db, identity.email);
        if (!winner) throw err; // Some other failure -- not the race we're recovering from.
        linkGoogleAccount(db, winner.id, identity.sub);
        issueSessionCookie(req, res, createSession(db, winner.id));
        res.redirect("/");
        return;
      }
      if (isFirstEverAccount) {
        const migrated = migrateFlatFileProgress(db, newUser.id, OLD_PROGRESS_FILE);
        if (migrated) console.log(`✓ Migrated pre-upgrade progress.json into ${newUser.email}'s new account`);
      }
      if (isMailerConfigured()) {
        sendWelcomeEmail(newUser.email, newUser.name, `${publicOrigin(req)}/`).catch((err: unknown) => {
          console.error(`Failed to send welcome email to ${newUser.email}:`, err);
        });
      }
      linkGoogleAccount(db, newUser.id, identity.sub);
      user = newUser;
    }
  }

  issueSessionCookie(req, res, createSession(db, user.id));
  res.redirect("/");
});

// --- Issue #46: account-authenticated password management. Both require a valid session (the
//     Settings-page "Set a password" / "Change password" actions), distinct from the login-time
//     claim flow above, which is deliberately the LESS-preferred path (see the plan/CLAUDE.md's
//     "Identity & multi-user progress" section) since it re-opens the email-only trust window
//     instead of relying on an already-established session. ---
app.post("/api/account/password-setup", requireSession, express.json({ limit: "10kb" }), (req, res) => {
  const user = (res.locals as { user: UserRow }).user;
  if (user.passwordHash !== null) {
    res.status(409).json({ error: "This account already has a password — use change password instead." });
    return;
  }
  const body = req.body as { newPassword?: unknown } | null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 200) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}-200 characters.` });
    return;
  }
  setPassword(db, user.id, hashPassword(newPassword), getCookie(req, SESSION_COOKIE));
  res.status(204).end();
});

app.post("/api/account/password", requireSession, express.json({ limit: "10kb" }), (req, res) => {
  const user = (res.locals as { user: UserRow }).user;
  const body = req.body as { currentPassword?: unknown; newPassword?: unknown } | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (user.passwordHash === null || !verifyPassword(currentPassword, user.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 200) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}-200 characters.` });
    return;
  }
  setPassword(db, user.id, hashPassword(newPassword), getCookie(req, SESSION_COOKIE));
  res.status(204).end();
});

// --- Issue #59: self-service forgot-password, over email. A separate, longer-window rate limit
//     than the login lockout above (mail abuse, not credential guessing, is the risk here) — keyed
//     by normalized email for the same LAN/shared-NAT reason `checkRateLimit` above is. ---
const PASSWORD_RESET_MAX_REQUESTS = 3;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const passwordResetRequests = new Map<string, { count: number; windowStart: number }>();

function isPasswordResetRateLimited(email: string): boolean {
  const key = normalizeEmail(email);
  const now = Date.now();
  const entry = passwordResetRequests.get(key);
  if (!entry || now - entry.windowStart >= PASSWORD_RESET_WINDOW_MS) {
    passwordResetRequests.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > PASSWORD_RESET_MAX_REQUESTS;
}

app.post("/api/password-reset/request", express.json({ limit: "10kb" }), (req, res) => {
  const body = req.body as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  if (!isMailerConfigured()) {
    res.status(500).json({ error: "Email isn't configured on this server yet — ask the app operator to set it up." });
    return;
  }
  // Enumeration-safe: the response body is identical whether or not the account exists. Just as
  // important, it's sent BEFORE the (awaited-nowhere) sendPasswordResetEmail() call below resolves
  // -- an existing account triggers a real SMTP round trip that a nonexistent one never does, and
  // awaiting it here would leak exactly the fact this response is trying to hide via response
  // latency alone, generic body notwithstanding.
  const GENERIC_RESPONSE = { message: "If that email has an account, a reset link has been sent." };
  if (isPasswordResetRateLimited(email)) {
    res.json(GENERIC_RESPONSE);
    return;
  }
  const user = findUserByEmail(db, email);
  if (user) {
    const token = createPasswordResetToken(db, user.id, PASSWORD_RESET_TOKEN_TTL_MS);
    const resetUrl = `${publicOrigin(req)}/reset-password?token=${token}`;
    sendPasswordResetEmail(user.email, resetUrl).catch((err: unknown) => {
      console.error(`Failed to send password reset email to ${user.email}:`, err);
    });
  }
  res.json(GENERIC_RESPONSE);
});

app.post("/api/password-reset/confirm", express.json({ limit: "10kb" }), (req, res) => {
  const body = req.body as { token?: unknown; newPassword?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!token) {
    res.status(400).json({ error: "Missing reset token." });
    return;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 200) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}-200 characters.` });
    return;
  }
  const succeeded = completePasswordReset(db, token, hashPassword(newPassword));
  if (!succeeded) {
    res.status(400).json({ error: "This reset link is invalid or has expired." });
    return;
  }
  res.status(204).end();
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    // Issue #121: isPublicHost tells the client whether this request arrived over a public
    // hostname (real domain, or localhost) vs. a LAN private IP -- reuses isPrivateNetworkHost(),
    // the same per-request check issue #119 added for the Google OAuth button. App.tsx shows the
    // landing page only when this is true; a LAN visitor already has context from whoever shared
    // the address with them, so skipping straight to the gate is the right call there too.
    res.status(401).json({ error: "Not logged in.", isPublicHost: !isPrivateNetworkHost(req.hostname) });
    return;
  }
  // hasPassword (issue #46) tells SettingsPanel whether to offer "Set a password" (a legacy
  // account still on the claim path) or "Change password" (already protected). role (issue #62)
  // tells Sidebar.tsx whether to show the Admin nav link.
  res.json({ email: user.email, name: user.name, hasPassword: user.passwordHash !== null, role: user.role });
});

app.post("/api/logout", (req, res) => {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) deleteSession(db, token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

// --- Issue #62: admin user management (list/add/remove/change-role). Every route below is
//     `requireSession, requireAdmin` — see requireAdmin's own comment for why the frontend's own
//     hiding of the Admin page is never trusted as the real gate. ---
app.get("/api/admin/users", requireSession, requireAdmin, (req, res) => {
  res.json({ users: listAllUsers(db) });
});

app.post("/api/admin/users", requireSession, requireAdmin, express.json({ limit: "10kb" }), async (req, res) => {
  const body = req.body as { email?: unknown; name?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  if (name.length === 0 || name.length > 100) {
    res.status(400).json({ error: "Name is required and must be 100 characters or fewer." });
    return;
  }
  const tempPassword = generateTemporaryPassword();
  const user = createUserByAdmin(db, email, name, hashPassword(tempPassword));
  if (!user) {
    res.status(400).json({ error: "An account with that email already exists." });
    return;
  }
  // Authenticated admin action, not the enumeration-sensitive forgot-password flow (#59) — safe to
  // report the real outcome, including the temp password itself as a manual fallback if SMTP isn't
  // configured or delivery fails, so this action never silently strands the admin.
  let emailSent = false;
  if (isMailerConfigured()) {
    try {
      const loginUrl = `${publicOrigin(req)}/`;
      await sendAdminCreatedAccountEmail(user.email, user.name, tempPassword, loginUrl);
      emailSent = true;
    } catch (err) {
      console.error(`Failed to send welcome email to ${user.email}:`, err);
    }
  }
  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, tempPassword, emailSent });
});

app.delete("/api/admin/users/:id", requireSession, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  const requester = (res.locals as { user: UserRow }).user;
  if (!Number.isInteger(targetId)) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }
  if (targetId === requester.id) {
    res.status(400).json({ error: "You can't remove your own account. Ask another admin, or use admin-users.mjs." });
    return;
  }
  const target = findUserById(db, targetId);
  if (!target) {
    res.status(404).json({ error: "No such user." });
    return;
  }
  if (target.role === "admin" && countAdmins(db) <= 1) {
    res.status(400).json({ error: "Can't remove the last remaining admin." });
    return;
  }
  deleteUser(db, targetId);
  res.status(204).end();
});

app.patch(
  "/api/admin/users/:id/role",
  requireSession,
  requireAdmin,
  express.json({ limit: "10kb" }),
  (req, res) => {
    const targetId = Number(req.params.id);
    const requester = (res.locals as { user: UserRow }).user;
    const body = req.body as { role?: unknown } | null;
    const role = body?.role;
    if (!Number.isInteger(targetId)) {
      res.status(400).json({ error: "Invalid user id." });
      return;
    }
    if (role !== "user" && role !== "admin") {
      res.status(400).json({ error: 'role must be "user" or "admin".' });
      return;
    }
    // Never your own role, in either direction -- same reasoning as the DELETE route's self-delete
    // guard above: an admin demoting themselves mid-session has no in-app way back if no other
    // admin happens to be around (or the last one, where countAdmins() would already catch it, but
    // this also covers the "one of several admins" case, which that check alone wouldn't).
    if (targetId === requester.id) {
      res.status(400).json({ error: "You can't change your own role. Ask another admin, or use admin-users.mjs." });
      return;
    }
    const target = findUserById(db, targetId);
    if (!target) {
      res.status(404).json({ error: "No such user." });
      return;
    }
    if (target.role === "admin" && role === "user" && countAdmins(db) <= 1) {
      res.status(400).json({ error: "Can't demote the last remaining admin." });
      return;
    }
    setUserRole(db, targetId, role as UserRole);
    res.status(204).end();
  },
);

// --- Progress: GET/PUT /api/progress, now scoped to the logged-in user's own row in `progress`
//     (SQLite, see db.ts) instead of a single shared /data/progress.json. Always the whole
//     object — no partial merges — matching spec §4's write contract exactly, unchanged from the
//     flat-file version.
//
//     A user's progress row still has more than one writer: this route, and the snowprep-quiz MCP
//     server (mcp-server/src/progressStore.ts) writing the same snowprep.sqlite file directly —
//     bind-mounted to the same path, no HTTP involved, always scoped to one fixed "owner" row (see
//     that file's own header comment). Without a concurrency check, a browser tab's debounced PUT
//     of its own (possibly stale) in-memory state can silently overwrite an attempt the MCP server
//     just wrote a moment earlier, with no error anywhere — a real incident that happened once
//     under the old flat-file version, not a hypothetical one. ETag/If-Match (the row's updated_at
//     as the revision, see db.ts's writeProgressRow()) narrows that down the same way the old
//     mtime-based check did: GET reports the revision it read at, PUT must echo it back, and a
//     mismatch means someone else wrote in between. Still optimistic concurrency (a check, then an
//     act) at the HTTP-contract level — db.ts's writeProgressRow() closes the lower-level race with
//     a real BEGIN IMMEDIATE transaction, but two independent PUTs racing this same route can still
//     each read a stale revision before either writes, same as before. Acceptable given this app's
//     actual write cadence (human/LLM-paced, not concurrent high-frequency writers).
//
//     Issue #107 follow-up: the revision is ALSO echoed as a `rev` field in the JSON body (both
//     routes), not just the ETag header. Confirmed live against the public Railway deployment: once
//     a response is large enough for Railway's edge to gzip it (any real browser negotiates this by
//     default via Accept-Encoding), the ETag response header does not reliably survive that
//     transformation -- reproduced directly with curl --compressed vs. plain curl against the same
//     account: identical request, but the ETag header is simply absent once Content-Encoding: gzip
//     is applied. This happens entirely at Railway's edge (this app has no compression middleware
//     of its own -- grep confirms), so it can't be fixed from here; the header is kept for any
//     environment/proxy where it does survive (e.g. no such issue exists talking to
//     `localhost:8080` directly, no compressing proxy in front), but the body-carried `rev` is the
//     one the client actually trusts (progress.ts). Request headers (the PUT's own `If-Match`) are
//     unaffected either way -- compression only touches outgoing responses, never incoming requests
//     -- so only the *response*-carried revision needed this fallback. ---
app.get("/api/progress", requireSession, (_req, res) => {
  const user = (res.locals as { user: UserRow }).user;
  const row = getProgressRow(db, user.id);
  const rev = row?.updatedAt ?? "0";
  res.set("ETag", rev);
  res.json({ ...(row ? JSON.parse(row.data) : defaultProgressState()), rev });
});

app.put("/api/progress", requireSession, express.json({ limit: "2mb" }), (req, res) => {
  const user = (res.locals as { user: UserRow }).user;
  if (typeof req.body !== "object" || req.body === null) {
    res.status(400).json({ error: "body must be a JSON object" });
    return;
  }
  const ifMatch = req.get("If-Match");
  if (ifMatch === undefined) {
    res.status(400).json({ error: "If-Match header required (send back the ETag from GET /api/progress)" });
    return;
  }
  try {
    const newRev = writeProgressRow(db, user.id, JSON.stringify(req.body), ifMatch);
    res.set("ETag", newRev).status(200).json({ rev: newRev });
  } catch (err) {
    if (err instanceof ProgressConflictError) {
      res.status(409).json({
        error: "Your progress changed since you last read it (e.g. by the MCP quiz server). Re-fetch GET /api/progress and retry your change against the fresh copy.",
      });
      return;
    }
    console.error(`PUT /api/progress: failed writing progress for user ${user.id}: ${err}`);
    res.status(500).json({ error: "failed to persist progress" });
  }
});

// --- Static: hashed bundle assets (Vite's default assetsDir) get a long, immutable cache; the
//     app shell and the boot-time-regenerated JSON must revalidate every time, or a content
//     update or a rebuild could be masked by a stale cached response. ---
app.use("/assets", express.static(path.join(DIST_DIR, "assets"), { maxAge: "365d", immutable: true }));
app.use(
  express.static(config.outputDir, {
    maxAge: 0,
    setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
  }),
);
app.use(
  express.static(DIST_DIR, {
    index: "index.html",
    maxAge: 0,
    setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
  }),
);

// --- SPA fallback: client-side routes (/notes/d1, /session/set-d1, ...) have no matching file
//     on disk — any other GET that isn't /api/* serves index.html so the router can take over. ---
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✓ Serving on http://0.0.0.0:${PORT}  (content: ${config.outputDir}, data: ${DATA_DIR})`);
});
