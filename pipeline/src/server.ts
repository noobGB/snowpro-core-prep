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
  createGuestUser,
  createPasswordResetToken,
  createSession,
  createUserByAdmin,
  deleteSession,
  deleteUser,
  findUserByEmail,
  findUserByGoogleSub,
  findUserById,
  ensureConfiguredAdmins,
  getProgressRow,
  guestUsersCount,
  humanUsersCount,
  linkGoogleAccount,
  listAllUsers,
  migrateFlatFileProgress,
  normalizeEmail,
  openDb,
  parseAdminEmails,
  reapGuests,
  resolveSession,
  SESSION_MAX_AGE_MS,
  setPassword,
  setPasswordIfUnset,
  setUserRole,
  upgradeGuest,
  upsertUserOnLogin,
  writeProgressRow,
  ProgressConflictError,
  type Db,
  type UserRole,
  type UserRow,
} from "./db.js";
import { hashPassword, verifyPassword, generateTemporaryPassword, MIN_PASSWORD_LENGTH } from "./passwords.js";
import {
  isMailerConfigured,
  sendAdminCreatedAccountEmail,
  sendPasswordResetEmail,
  sendSupportMessage,
  sendWelcomeEmail,
  supportRecipient,
} from "./mailer.js";
import { buildAuthUrl, exchangeCodeForIdentity, isGoogleOAuthConfigured, resolveGoogleAccountLink } from "./oauth.js";
import { createLoginLockout } from "./loginLockout.js";
import { createRegistrationLimiter } from "./registrationLimit.js";
import { createSupportLimiter } from "./supportLimit.js";
import { createGuestLimiter } from "./guestLimit.js";
import { resolveGuestConfig } from "./guestMode.js";
import { resolveLegalConfig } from "./write/legalConfig.js";
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
// SESSION_MAX_AGE_MS (db.ts) is the single source of truth for this -- shared between the cookie's
// own Max-Age below and resolveSession()'s server-side expiry check, so the two can't drift apart.

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
//     silently stale the moment anyone edits that script without remembering to recompute it.
//
//     Issue #189 removed the last external origin: the fonts are self-hosted now (see the @import
//     at the top of app/src/styles/tokens.css), so style-src and font-src no longer name
//     fonts.googleapis.com / fonts.gstatic.com and `default-src 'self'` is literally true. If you
//     ever add a third-party origin here, that sentence stops being true -- rewrite it rather than
//     leaving it to mislead the next reader. `'unsafe-inline'` on script-src remains the one real
//     weakness, for the reason above. ---
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
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

/** Security (issue #139): `publicOrigin()`'s Host-header fallback above is a deliberate, accepted
 *  design for the admin-invite flow (see this function's own header comment) -- an authenticated
 *  admin's own current request address is genuinely the right address to use for someone they
 *  just invited, since it's the LAN address they're proven to be reachable on right now. It is
 *  NOT safe for a link embedded in an email triggered by an *unauthenticated* request, where the
 *  request's email target and its Host header can be two completely independent attacker-chosen
 *  values -- an attacker (anyone able to reach this server, not necessarily its real intended
 *  users) can POST a real victim's email with a spoofed `Host` header and get the server to mail
 *  that victim a password-reset (or welcome) link pointing at an attacker-chosen domain. This
 *  helper is used at exactly those unauthenticated, attacker-triggerable-for-an-arbitrary-victim
 *  call sites (password reset, welcome emails) -- `null` means "don't trust this request's Host
 *  header for a link going into someone else's inbox," and callers skip sending rather than
 *  build one anyway. `SNOWPRO_HOST_NAME` was always available as a manual override; this makes it
 *  a *requirement* for these specific email flows rather than an optional nicety, trading a little
 *  zero-config LAN convenience (an operator who never sets it now needs to for these emails to
 *  send at all) for closing a real spoofing vector. OAuth's own use of `publicOrigin()`
 *  (`redirect_uri`) is deliberately NOT restricted the same way -- Google independently validates
 *  the `redirect_uri` against what's registered in Cloud Console and simply rejects a mismatch, so
 *  that call site already has a real backstop this one doesn't. */
function trustedPublicOrigin(req: express.Request): string | null {
  return process.env.SNOWPRO_HOST_NAME ? publicOrigin(req) : null;
}

/** `maxAgeMs` defaults to the normal 400-day session. Guest sessions pass their own TTL instead --
 *  see POST /api/auth/guest for why a cookie outliving the row it points at is worse than useless. */
function issueSessionCookie(
  req: express.Request,
  res: express.Response,
  token: string,
  maxAgeMs: number = SESSION_MAX_AGE_MS,
): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    path: "/",
    maxAge: maxAgeMs,
  });
}

// Issue #46 brute-force guard / issue #131's unbounded-lockout fix -- see loginLockout.ts's own
// header comment for the full reasoning, extracted there so its cap behavior has real unit tests.
const { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt } = createLoginLockout();
// Issue #142: caps how fast new accounts can be created from one source -- see
// registrationLimit.ts's own header comment for why this is IP-keyed (registration, unlike login
// lockout, isn't a per-person concern).
const registrationLimiter = createRegistrationLimiter();
// Issue #160: separate limiter for the guest endpoint, which is unauthenticated -- see
// guestLimit.ts for why it needs a global bucket on top of the per-IP window.
const guestLimiter = createGuestLimiter();
const guestConfig = resolveGuestConfig();

/** Whether this deployment publishes the legal pages (issue #182 -- they exist only when an
 *  operator identity is configured). Reported by /api/me so SiteFooter links to them only when
 *  they are really there.
 *
 *  This has to be advertised rather than assumed: the SPA catch-all answers any unknown path with
 *  the app shell at 200, so a link to a page that was never generated does not 404 -- it silently
 *  drops the reader into the application instead of a policy, which is worse than no link.
 *
 *  Resolved once. The environment cannot change under a running container. */
const LEGAL_PAGES_AVAILABLE = resolveLegalConfig() !== null;

/** Issue #193. Resolved once -- the environment cannot change under a running container. */
const SUPPORT_RECIPIENT = supportRecipient();
const supportLimiter = createSupportLimiter();
const MAX_SUPPORT_MESSAGE = 5000;
/** Reported by /api/me so the client hides the support entry points on an instance that cannot
 *  actually deliver a message -- an offer to contact support that silently goes nowhere is worse
 *  than no offer. Mirrors how `legalPages` gates the footer links. */
const SUPPORT_AVAILABLE = SUPPORT_RECIPIENT !== undefined && isMailerConfigured();

/** Issue #159: accounts declared admin out of band, so administrator rights don't depend on who
 *  happened to sign up first. Read once at boot -- changing it is a deploy/restart, matching every
 *  other SNOWPRO_* variable. */
const CONFIGURED_ADMIN_EMAILS = parseAdminEmails(process.env.SNOWPRO_ADMIN_EMAILS);

/** Promotes any already-existing declared admins. Runs at boot so setting the variable takes effect
 *  on the next restart even for an account created long ago; the signup paths below handle the
 *  account that doesn't exist yet. Grant-only -- see `ensureConfiguredAdmins()`. */
function applyConfiguredAdmins(): void {
  if (CONFIGURED_ADMIN_EMAILS.length === 0) return;
  const promoted = ensureConfiguredAdmins(db, CONFIGURED_ADMIN_EMAILS);
  if (promoted.length > 0) console.log(`✓ Promoted to admin via SNOWPRO_ADMIN_EMAILS: ${promoted.join(", ")}`);
}

/** The role a brand-new account should get.
 *
 *  Replaces the previous `usersCount(db) === 0` rule at both signup call sites (password and
 *  Google). Two changes: a declared admin wins outright, and the fallback counts only *human*
 *  accounts. The second matters because an anonymous visitor can now create a `users` row by
 *  clicking "Explore the demo" -- without it, one guest arriving before the operator's own first
 *  signup would permanently lock the operator out of /admin on a fresh instance. */
function roleForNewAccount(email: string): UserRole {
  if (CONFIGURED_ADMIN_EMAILS.includes(normalizeEmail(email))) return "admin";
  return humanUsersCount(db) === 0 ? "admin" : "user";
}

/** Deletes (or, in log mode, reports) demo guests idle past the TTL.
 *
 *  Runs at boot -- catching a container that was down for a week -- and then on an interval.
 *  `.unref()` so the timer never holds the process open against the SIGTERM/SIGINT graceful
 *  shutdown handler. Deliberately NOT run on the request path: a DELETE sweep there would add
 *  latency to a hot path and hand an attacker control over when it fires. */
const GUEST_REAP_INTERVAL_MS = 6 * 60 * 60_000;
function reapGuestsNow(): void {
  if (!guestConfig.enabled) return;
  try {
    const dryRun = guestConfig.reapMode === "log";
    const { ids } = reapGuests(db, { ttlMs: guestConfig.ttlMs, dryRun });
    if (ids.length === 0) return;
    console.log(
      dryRun
        ? `[guest reaper: log mode] would delete ${ids.length} idle guest account(s). Set SNOWPRO_GUEST_REAP=delete to enact.`
        : `✓ Reaped ${ids.length} idle guest account(s)`,
    );
  } catch (err: unknown) {
    // A failed reap must never take the site down -- it's housekeeping, and the next tick retries.
    console.error("Guest reaper failed:", err);
  }
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
    if (registrationLimiter.isRateLimited(req.ip ?? "")) {
      res.status(429).json({ error: "Too many accounts created recently from this network. Please try again in a few minutes." });
      return;
    }
    // Issue #62/#159: a declared admin (SNOWPRO_ADMIN_EMAILS) wins; otherwise the first *human*
    // account on a fresh database becomes admin. See roleForNewAccount() for why "human" and not
    // "any row". The live-database equivalent (a pre-existing account with no admin yet) is handled
    // once, at boot, by db.ts's addRoleColumnIfMissing() migration and applyConfiguredAdmins().
    const isFirstEverAccount = humanUsersCount(db) === 0;
    const user = upsertUserOnLogin(db, email, name, hashPassword(password), roleForNewAccount(email));
    registrationLimiter.recordSignup(req.ip ?? "");
    if (isFirstEverAccount) {
      const migrated = migrateFlatFileProgress(db, user.id, OLD_PROGRESS_FILE);
      if (migrated) console.log(`✓ Migrated pre-upgrade progress.json into ${user.email}'s new account`);
    }
    // Fire-and-forget, same pattern as the password-reset email below — no secret to convey, no
    // reason to make the response wait on an SMTP round trip or to report delivery back to the
    // client.
    if (isMailerConfigured()) {
      const origin = trustedPublicOrigin(req);
      if (origin) {
        sendWelcomeEmail(user.email, user.name, `${origin}/`).catch((err: unknown) => {
          console.error(`Failed to send welcome email to ${user.email}:`, err);
        });
      } else {
        console.warn(`Skipped welcome email to ${user.email}: SNOWPRO_HOST_NAME isn't set (see trustedPublicOrigin()'s doc comment).`);
      }
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
      const isFirstEverAccount = humanUsersCount(db) === 0;
      // Same declared-admin-then-first-human rule as the password-signup path above (#62/#159) --
      // passwordHash omitted (stays NULL), exactly the existing "no local password" shape
      // SettingsPanel/LoginGate already handle for legacy accounts (see the plan's design notes).
      // A `const` here (not reassigning the outer `let user` directly) deliberately, matching how
      // the password-signup route above does this -- TypeScript can't narrow a mutable `let`
      // inside the sendWelcomeEmail().catch() closure below, since the closure could in principle
      // run after a later reassignment; a `const` has no such ambiguity.
      let newUser;
      try {
        newUser = upsertUserOnLogin(db, identity.email, identity.name, undefined, roleForNewAccount(identity.email));
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
        const origin = trustedPublicOrigin(req);
        if (origin) {
          sendWelcomeEmail(newUser.email, newUser.name, `${origin}/`).catch((err: unknown) => {
            console.error(`Failed to send welcome email to ${newUser.email}:`, err);
          });
        } else {
          console.warn(`Skipped welcome email to ${newUser.email}: SNOWPRO_HOST_NAME isn't set (see trustedPublicOrigin()'s doc comment).`);
        }
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
    const origin = trustedPublicOrigin(req);
    if (!origin) {
      // Same enumeration-safety reasoning as above applies here too -- this must not change the
      // response shape or add a timing difference vs. the "no such account" path, so it's a plain
      // skip, not an early return with a different response.
      console.warn(`Skipped password-reset email to ${user.email}: SNOWPRO_HOST_NAME isn't set (see trustedPublicOrigin()'s doc comment).`);
    } else {
      const token = createPasswordResetToken(db, user.id, PASSWORD_RESET_TOKEN_TTL_MS);
      const resetUrl = `${origin}/reset-password?token=${token}`;
      sendPasswordResetEmail(user.email, resetUrl).catch((err: unknown) => {
        console.error(`Failed to send password reset email to ${user.email}:`, err);
      });
    }
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

/** Issue #160: mints an ephemeral demo account and signs the browser in, so a visitor arriving from
 *  a shared link can use the real app without registering.
 *
 *  404 when disabled, matching the Google OAuth routes' convention ("the feature does not exist"
 *  rather than "you may not"), and consistent with `/api/me` reporting `guestAvailable: false` so
 *  the UI never renders a button that fails.
 *
 *  Idempotent for a browser that already holds a guest session: returns 200 without minting a
 *  second row. This kills the double-click and refresh amplifiers outright and makes the endpoint
 *  safe to call from a React effect, which matters more than it sounds -- it is the difference
 *  between one row per visitor and one row per impatient click. */
app.post("/api/auth/guest", (req, res) => {
  if (!guestConfig.enabled) {
    res.status(404).json({ error: "Guest mode is not enabled on this instance." });
    return;
  }

  const existing = currentUser(req);
  if (existing?.isGuest) {
    res.json({ email: existing.email, name: existing.name, isGuest: true });
    return;
  }
  if (existing) {
    // A real account is already signed in; silently replacing their session with a guest one would
    // be a genuinely destructive surprise.
    res.status(409).json({ error: "You're already signed in." });
    return;
  }

  const ip = req.ip ?? "";
  const verdict = guestLimiter.check(ip);
  if (verdict !== "ok") {
    // Logged distinctly: a global refusal means the whole instance is at its ceiling, which is an
    // incident signal, while a per-IP refusal is routine and needs no attention.
    if (verdict === "global-limited") console.warn("Guest creation refused: global rate ceiling reached.");
    res.status(429).json({ error: "The demo is busy right now. Please try again in a moment." });
    return;
  }

  // Capacity check, with an opportunistic reap first: better to reclaim genuinely dead rows than to
  // turn a real visitor away. Refusing beats evicting -- evicting could drop someone mid-exam.
  if (guestUsersCount(db) >= guestConfig.maxLive) {
    reapGuestsNow();
    if (guestUsersCount(db) >= guestConfig.maxLive) {
      res.status(503).json({ error: "The demo is at capacity right now — create a free account to continue." });
      return;
    }
  }

  const guest = createGuestUser(db);
  guestLimiter.record(ip);
  // Cookie lifetime is the guest TTL, not SESSION_MAX_AGE_MS's 400 days: once the row is reaped the
  // token refers to nothing, and leaving a browser holding it for a year would mean a confusing
  // "signed in but broken" state instead of a clean signed-out one.
  issueSessionCookie(req, res, createSession(db, guest.id), guestConfig.ttlMs);
  res.json({ email: guest.email, name: guest.name, isGuest: true });
});

/** Issue #164: promotes the current demo guest into a permanent account, in place.
 *
 *  The whole point of guests being real `users` rows: this is one UPDATE. The progress row is keyed
 *  by `user_id` and is never touched, so a visitor keeps every attempt, flashcard grade and plan
 *  tick they accumulated during the demo. No copy, no merge, no migration step that could fail
 *  halfway.
 *
 *  Rate-limited by the *registration* limiter rather than the guest one, because that is what this
 *  actually is -- a new permanent account being created. Using the guest limiter would let someone
 *  mint accounts at the guest rate, which is the looser of the two.
 *
 *  The session cookie deliberately survives: the row's id doesn't change, so the existing session
 *  keeps pointing at the same (now permanent) account and the user stays signed in with no
 *  re-login. Its Max-Age was set to the guest TTL when it was issued, so it's reissued here at the
 *  normal session lifetime -- otherwise a converted account would be silently signed out on the
 *  day the guest cookie would have expired. */
app.post("/api/account/upgrade", requireSession, express.json({ limit: "10kb" }), (req, res) => {
  const user = (res.locals as { user: UserRow }).user;
  if (!user.isGuest) {
    res.status(409).json({ error: "This is already a permanent account." });
    return;
  }

  const body = req.body as { email?: unknown; name?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (name.length === 0 || name.length > 80) {
    res.status(400).json({ error: "Enter a name (up to 80 characters)." });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}-200 characters.` });
    return;
  }
  if (registrationLimiter.isRateLimited(req.ip ?? "")) {
    res.status(429).json({ error: "Too many accounts created recently from this network. Please try again in a few minutes." });
    return;
  }

  // Returns null when the address already belongs to someone else. Deliberately NOT merged into
  // that account: combining two sets of progress has real conflict semantics and guessing at them
  // silently would be the wrong kind of helpful.
  const upgraded = upgradeGuest(db, user.id, { email, name, passwordHash: hashPassword(password) });
  if (!upgraded) {
    res.status(409).json({ error: "That email already has an account — sign out and sign in to it instead." });
    return;
  }
  registrationLimiter.recordSignup(req.ip ?? "");

  // Promote if this address is a declared admin (#159) -- the same rule the signup paths apply, so
  // converting a guest can't be a back door around it in either direction.
  applyConfiguredAdmins();
  const finalUser = findUserById(db, upgraded.id) ?? upgraded;

  const token = getCookie(req, SESSION_COOKIE);
  if (token) issueSessionCookie(req, res, token);

  if (isMailerConfigured()) {
    const origin = trustedPublicOrigin(req);
    if (origin) {
      sendWelcomeEmail(finalUser.email, finalUser.name, `${origin}/`).catch((err: unknown) => {
        console.error(`Failed to send welcome email to ${finalUser.email}:`, err);
      });
    } else {
      console.warn(`Skipped welcome email to ${finalUser.email}: SNOWPRO_HOST_NAME isn't set (see trustedPublicOrigin()'s doc comment).`);
    }
  }

  res.json({
    email: finalUser.email,
    name: finalUser.name,
    hasPassword: true,
    role: finalUser.role,
    isGuest: false,
  });
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    // Issue #121: isPublicHost tells the client whether this request arrived over a public
    // hostname (real domain, or localhost) vs. a LAN private IP -- reuses isPrivateNetworkHost(),
    // the same per-request check issue #119 added for the Google OAuth button. App.tsx shows the
    // landing page only when this is true; a LAN visitor already has context from whoever shared
    // the address with them, so skipping straight to the gate is the right call there too.
    res.status(401).json({
      error: "Not logged in.",
      isPublicHost: !isPrivateNetworkHost(req.hostname),
      // Rides on this existing 401 body rather than a separate /available route (as Google OAuth
      // needed): App.tsx already fetches exactly this, so it costs no extra round trip on the cold
      // visitor's critical path. Also false on a LAN host -- a guest row on a self-hosted box is
      // litter with no conversion upside, and the visitor was invited by the operator anyway.
      guestAvailable: guestConfig.enabled && !isPrivateNetworkHost(req.hostname),
      legalPages: LEGAL_PAGES_AVAILABLE,
      supportAvailable: SUPPORT_AVAILABLE,
    });
    return;
  }
  // hasPassword (issue #46) tells SettingsPanel whether to offer "Set a password" (a legacy
  // account still on the claim path) or "Change password" (already protected). role (issue #62)
  // tells Sidebar.tsx whether to show the Admin nav link.
  res.json({
    email: user.email,
    name: user.name,
    hasPassword: user.passwordHash !== null,
    role: user.role,
    isGuest: user.isGuest,
    legalPages: LEGAL_PAGES_AVAILABLE,
    supportAvailable: SUPPORT_AVAILABLE,
  });
});

app.post("/api/logout", (req, res) => {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) deleteSession(db, token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

/** Issue #193 -- the in-app support form. Before this there was no way to report anything from
 *  inside the app: #177 removed the link to the issue tracker (the site does not present itself as
 *  having a public upstream), and nothing replaced it. A user who spotted a wrong answer had
 *  nowhere to send it.
 *
 *  DELIBERATELY NOT BEHIND requireSession. The most urgent support request is "I can't sign in",
 *  and that person has no session by definition. Gating this would refuse help to exactly the
 *  people who most need it.
 *
 *  THE RECIPIENT IS FIXED SERVER-SIDE (see `supportRecipient()`), never read from the request. That
 *  is the one property that keeps an unauthenticated send-email endpoint from being an open relay:
 *  a caller controls what the message says, never who receives it. Their own address goes in
 *  Reply-To, which reaches them without letting them address mail through this server.
 *
 *  404 when no support address is configured, rather than accepting a message it would silently
 *  drop -- the same rule the legal pages follow, and the client hides the entry points to match. */
app.post("/api/support", express.json({ limit: "16kb" }), (req, res) => {
  if (!SUPPORT_RECIPIENT || !isMailerConfigured()) {
    res.status(404).json({ error: "Support requests aren't enabled on this instance." });
    return;
  }

  const body = req.body as { email?: unknown; name?: unknown; message?: unknown; website?: unknown; path?: unknown } | null;

  // Honeypot. A real form keeps this hidden and empty; bots fill every field they find. Answered
  // with 204 rather than an error on purpose -- telling a bot which check it failed just teaches it
  // to pass next time, and there is no human on the other end to confuse.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    res.status(204).end();
    return;
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 10) {
    res.status(400).json({ error: "Please describe the problem in a little more detail." });
    return;
  }
  if (message.length > MAX_SUPPORT_MESSAGE) {
    res.status(400).json({ error: `Please keep it under ${MAX_SUPPORT_MESSAGE} characters.` });
    return;
  }

  // A signed-in real account's own address is authoritative and cannot be spoofed by the body. A
  // guest's cannot be used: createGuestUser() mints `guest-<32 hex>@guest.invalid`, an RFC 2606
  // address that can never receive a reply, so a guest has to supply a real one like a signed-out
  // visitor does.
  const user = currentUser(req);
  const accountEmail = user && !user.isGuest ? user.email : null;
  const suppliedEmail = typeof body?.email === "string" ? body.email.trim() : "";
  const fromEmail = accountEmail ?? suppliedEmail;
  if (!EMAIL_RE.test(fromEmail)) {
    res.status(400).json({ error: "Enter an email address we can reply to." });
    return;
  }

  const suppliedName = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const fromName = (user && !user.isGuest ? user.name : suppliedName) || "Someone";

  if (supportLimiter.isRateLimited(req.ip ?? "")) {
    res.status(429).json({ error: "You've sent a few messages already — please give it a few minutes." });
    return;
  }

  // Context the operator needs and the reporter would not think to include. "One of the questions
  // was wrong" is unactionable; the same message with the page it came from is not.
  const context = [
    `Account: ${user ? (user.isGuest ? "guest (demo)" : `${user.email} (id ${user.id})`) : "not signed in"}`,
    `Page: ${typeof body?.path === "string" ? body.path.slice(0, 200) : "(unknown)"}`,
    `Sent: ${new Date().toISOString()}`,
  ];

  supportLimiter.recordSend(req.ip ?? "");

  // Fire-and-forget, matching the welcome/reset sends: the reporter should not wait on an SMTP
  // round trip, and a delivery failure is an operator problem, not something to hand back to
  // someone who has already written out their issue.
  sendSupportMessage({ to: SUPPORT_RECIPIENT, fromEmail, fromName, message, context }).catch((err: unknown) => {
    console.error(`Failed to deliver a support message from ${fromEmail}:`, err);
  });

  res.status(204).end();
});

/** The phrase a passwordless account has to type. Deliberately not "yes" or "confirm": it has to be
 *  long enough that it cannot be produced by a stray keypress or an over-eager click-through. */
const DELETE_CONFIRM_PHRASE = "delete my account";

/** Issue #180 — self-service erasure (GDPR Art. 17 / DPDP). Previously an account could only be
 *  removed by an admin or the operator CLI, which makes the right to erasure a favour the operator
 *  performs rather than something the person controls.
 *
 *  RE-AUTHENTICATION IS REQUIRED, and the session cookie alone deliberately isn't enough. This is
 *  irreversible and there is no soft delete, no backup, and nothing to restore from -- an unlocked
 *  or borrowed browser must not be able to destroy someone's study history in one click. Which
 *  proof is demanded depends on what the account actually has:
 *
 *   - A password account proves it with the password (`verifyPassword`), same as
 *     `/api/account/password` already does for a far less destructive change.
 *   - A Google-only account has `passwordHash === null`, and a guest's hash is the deliberately
 *     unusable sentinel from `createGuestUser()` -- `verifyPassword()` returns false for it by
 *     construction, so demanding a password would make those accounts undeletable. They type a
 *     confirmation phrase instead. That is a deliberate-action check, not authentication, and it is
 *     described that way in the UI rather than dressed up as something stronger.
 *
 *  Reuses `deleteUser()` rather than writing a second delete path. Issue #175 was the same bug
 *  living in two hand-maintained copies at once; adding a third is how that repeats. */
app.delete("/api/account", requireSession, express.json({ limit: "10kb" }), (req, res) => {
  const user = (res.locals as { user: UserRow }).user;

  // Unlike the admin route there is no "ask another admin" to suggest -- if the last admin deletes
  // themselves, nobody can administer the instance and no UI path exists to fix it.
  if (user.role === "admin" && countAdmins(db) <= 1) {
    res.status(400).json({
      error: "You're the only admin. Promote someone else first, or remove this account with the admin-users CLI.",
    });
    return;
  }

  const body = req.body as { password?: unknown; confirm?: unknown } | null;
  const usesPassword = !user.isGuest && user.passwordHash !== null;

  if (usesPassword) {
    const password = typeof body?.password === "string" ? body.password : "";
    if (!verifyPassword(password, user.passwordHash as string)) {
      res.status(403).json({ error: "That password is incorrect." });
      return;
    }
  } else {
    const confirm = typeof body?.confirm === "string" ? body.confirm.trim().toLowerCase() : "";
    if (confirm !== DELETE_CONFIRM_PHRASE) {
      res.status(400).json({ error: `Type "${DELETE_CONFIRM_PHRASE}" to confirm.` });
      return;
    }
  }

  deleteUser(db, user.id);
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
    // express.static defaults to dotfiles: "ignore", which 404s any path containing a dot-prefixed
    // segment -- so /.well-known/security.txt fell through to the SPA catch-all and answered with
    // the app shell at 200 (issue #182). Every well-known URI is dot-prefixed by definition, so
    // this has to be allowed for any of them to work. Safe here: this directory holds only
    // pipeline-generated output, never user uploads or repository files.
    dotfiles: "allow",
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

// Issue #159: promote any declared admins that already have accounts. Before listen(), so an
// operator can never race a request against their own privileges being applied.
applyConfiguredAdmins();

// Issue #160. Boot sweep catches a container that was down longer than the TTL, then a periodic
// one. .unref() so this timer never keeps the process alive against the shutdown handler below.
if (guestConfig.enabled) {
  console.log(
    `✓ Guest demo mode ENABLED (ttl ${Math.round(guestConfig.ttlMs / 86_400_000)}d, ` +
      `max ${guestConfig.maxLive} live, reaper in ${guestConfig.reapMode} mode)`,
  );
  reapGuestsNow();
  setInterval(reapGuestsNow, GUEST_REAP_INTERVAL_MS).unref();
}

const httpServer = app.listen(PORT, () => {
  console.log(`✓ Serving on http://0.0.0.0:${PORT}  (content: ${config.outputDir}, data: ${DATA_DIR})`);
});

// Graceful shutdown: Railway (and most container orchestrators) send SIGTERM before force-killing
// on a redeploy. Without a handler, the process just dies mid-flight -- SQLite's rollback journal
// generally recovers cleanly from an abrupt kill (an incomplete transaction rolls back on next
// open), so this was never a live data-loss risk, but stopping new connections and closing the DB
// handle cleanly is the correct behavior now that real user writes happen against this process,
// not a theoretical nicety. The 5s fallback timer covers the case where server.close() itself
// hangs (an open keep-alive connection that never finishes) -- exits anyway rather than becoming
// the next un-killable process Railway has to force-kill.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down gracefully...`);
  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out after 5s -- forcing exit.");
    process.exit(1);
  }, 5000);
  forceExit.unref();
  httpServer.close(() => {
    db.close();
    clearTimeout(forceExit);
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
