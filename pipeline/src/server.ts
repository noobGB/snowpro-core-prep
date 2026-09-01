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
  findUserById,
  getProgressRow,
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
 *  On the local LAN deployment there's no such proxy, so this still just resolves to `http`. */
function publicOrigin(req: express.Request): string {
  const hostOverride = process.env.SNOWPRO_HOST_NAME;
  if (hostOverride) return `${req.protocol}://${hostOverride}:${PORT}`;
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

// --- Issue #46 brute-force guard: a lightweight in-memory lockout on repeated wrong-password
//     attempts, keyed by normalized email rather than IP -- LAN clients behind the same router/
//     NAT don't reliably differ by source IP, so an IP-keyed limiter would either lock out an
//     entire household together or not distinguish them at all. In-memory (not persisted) is fine
//     at this app's scale: a container restart clearing lockouts is an acceptable reset, not a
//     security hole, for a trusted-LAN threat model. ---
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_BASE_MS = 30_000;
const loginAttempts = new Map<string, { failures: number; lockedUntil: number }>();

/** Remaining lockout in whole seconds if `email` is currently locked out, or `undefined` if a
 *  login attempt can proceed right now. */
function checkRateLimit(email: string): number | undefined {
  const entry = loginAttempts.get(normalizeEmail(email));
  if (!entry || entry.lockedUntil <= Date.now()) return undefined;
  return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
}

function recordFailedAttempt(email: string): void {
  const key = normalizeEmail(email);
  const entry = loginAttempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_LOGIN_ATTEMPTS) {
    const extraFailures = entry.failures - MAX_LOGIN_ATTEMPTS;
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_BASE_MS * 2 ** extraFailures;
  }
  loginAttempts.set(key, entry);
}

function recordSuccessfulAttempt(email: string): void {
  loginAttempts.delete(normalizeEmail(email));
}

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

  // Issue #41's display-name edit (SettingsPanel's inline Name field), kept working unchanged
  // under issue #46: an already-authenticated session updating its OWN account's name never needs
  // a password — the live session cookie already proves ownership just as well as a password
  // would. Must be checked before every password branch below, or the existing "edit name" action
  // would start demanding a password it was never designed to collect.
  const sessionUser = currentUser(req);
  if (
    existing &&
    name !== undefined &&
    password === undefined &&
    newPassword === undefined &&
    sessionUser?.id === existing.id
  ) {
    const updated = upsertUserOnLogin(db, email, name);
    res.json({ status: "known", email: updated.email, name: updated.name });
    return;
  }

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
    res.status(401).json({ error: "Not logged in." });
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
//     actual write cadence (human/LLM-paced, not concurrent high-frequency writers). ---
app.get("/api/progress", requireSession, (_req, res) => {
  const user = (res.locals as { user: UserRow }).user;
  const row = getProgressRow(db, user.id);
  res.set("ETag", row?.updatedAt ?? "0");
  res.json(row ? JSON.parse(row.data) : defaultProgressState());
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
    res.set("ETag", newRev).status(204).end();
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
