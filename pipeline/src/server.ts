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
  createSession,
  deleteSession,
  getProgressRow,
  migrateFlatFileProgress,
  openDb,
  resolveSession,
  upsertUserOnLogin,
  usersCount,
  writeProgressRow,
  ProgressConflictError,
  type Db,
  type UserRow,
} from "./db.js";

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

// --- Identity: POST /api/session, GET /api/me, POST /api/logout. No password (explicit,
//     confirmed design decision for a trusted-LAN feature, not an oversight) — email is the sole
//     identity key (case/whitespace-normalized, see db.ts's normalizeEmail()), name is
//     display-only and never used for lookups. Sessions are a random token in an HTTP-only cookie
//     (SameSite=Lax, no Secure flag — plain HTTP on a LAN). ---
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
    res.status(401).json({ error: "Not logged in. POST /api/session with an email + name first." });
    return;
  }
  (res.locals as { user: UserRow }).user = user;
  next();
}

app.post("/api/session", express.json({ limit: "10kb" }), (req, res) => {
  const body = req.body as { email?: unknown; name?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  if (!name || name.length > 100) {
    res.status(400).json({ error: "A name (1-100 characters) is required." });
    return;
  }

  // Checked BEFORE creating the account: this whole handler is synchronous (no `await` anywhere
  // in this call chain, including every db.ts call), so nothing else can interleave between this
  // read and upsertUserOnLogin()'s write below — Node's single-threaded event loop only picks up
  // the next request once this handler returns. That's what makes "was the table empty right
  // before this signup" a safe, race-free way to detect "this is the very first account ever" and
  // gate the one-time flat-file migration on it.
  const isFirstEverAccount = usersCount(db) === 0;
  const user = upsertUserOnLogin(db, email, name);
  if (isFirstEverAccount) {
    const migrated = migrateFlatFileProgress(db, user.id, OLD_PROGRESS_FILE);
    if (migrated) console.log(`✓ Migrated pre-upgrade progress.json into ${user.email}'s new account`);
  }

  const token = createSession(db, user.id);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  });
  res.json({ email: user.email, name: user.name });
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in." });
    return;
  }
  res.json({ email: user.email, name: user.name });
});

app.post("/api/logout", (req, res) => {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) deleteSession(db, token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

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
