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
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolveConfig } from "./config.js";
import { runPipeline } from "./index.js";
import { writeOutput } from "./write/output.js";
import { printFailure, printNotices, printSuccess } from "./report.js";

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = path.resolve(process.env.SNOWPRO_DATA_DIR ?? "/data");
const DIST_DIR = path.resolve(process.env.SNOWPRO_DIST_DIR ?? "/app/dist");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");
const PROBE_FILE = path.join(DATA_DIR, ".snowprep-write-probe");

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

const app = express();

// --- Progress: GET/PUT /api/progress, backed by /data/progress.json. Always the whole object —
//     no partial merges — matching spec §4's write contract exactly. ---
app.get("/api/progress", (_req, res) => {
  if (!existsSync(PROGRESS_FILE)) {
    res.json(defaultProgressState());
    return;
  }
  try {
    res.json(JSON.parse(readFileSync(PROGRESS_FILE, "utf8")));
  } catch (err) {
    console.error(`GET /api/progress: unreadable ${PROGRESS_FILE}: ${err}`);
    res.status(500).json({ error: "progress file unreadable" });
  }
});

app.put("/api/progress", express.json({ limit: "2mb" }), (req, res) => {
  if (typeof req.body !== "object" || req.body === null) {
    res.status(400).json({ error: "body must be a JSON object" });
    return;
  }
  try {
    const tmp = `${PROGRESS_FILE}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(req.body), "utf8");
    renameSync(tmp, PROGRESS_FILE); // atomic swap, same pattern as write/output.ts's writer
    res.status(204).end();
  } catch (err) {
    console.error(`PUT /api/progress: failed writing ${PROGRESS_FILE}: ${err}`);
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
