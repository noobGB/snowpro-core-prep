/**
 * Reads/writes the same ./data/progress.json the web app's container serves via GET/PUT
 * /api/progress (pipeline/src/server.ts). docker-compose.yml bind-mounts ./data:/data (not a
 * named volume), so the host path this resolves to by default *is* the literal file the running
 * container also reads/writes — this process shares state with the web app without any HTTP call
 * between them.
 *
 * Path resolution mirrors pipeline/src/config.ts's own pattern (walk up from this file's own
 * import.meta.url to the webapp root, then default to a fixed subfolder) rather than pipeline's
 * /data absolute default, since that default is Docker-only and doesn't exist on the host.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import type { ProgressState } from "../../app/src/lib/progress.js";

const MCP_SERVER_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEBAPP_ROOT = path.dirname(MCP_SERVER_ROOT);
const DEFAULT_DATA_DIR = path.resolve(WEBAPP_ROOT, "data");

const DATA_DIR = path.resolve(process.env.SNOWPRO_DATA_DIR ?? DEFAULT_DATA_DIR);
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

/** Must match app/src/lib/progress.ts's defaultState() and pipeline/src/server.ts's
 *  defaultProgressState() — a third, intentional hand-copy (no npm workspace ties the three
 *  packages together; this mirrors server.ts's own shape exactly, including omitting `grades`
 *  from `flashcards`, since server.ts is this file's closest sibling — same file, same contract). */
export function defaultProgressState(): ProgressState {
  return {
    schemaVersion: 1,
    examDate: null,
    lastLocation: null,
    attempts: [],
    inProgress: null,
    flashcards: { seen: [], lastIndex: 0, grades: {} },
    plan: { checked: [] },
    setup: { checked: [] },
    settings: { theme: "dark" },
  };
}

export function readProgress(): ProgressState {
  if (!existsSync(PROGRESS_FILE)) return defaultProgressState();
  try {
    return { ...defaultProgressState(), ...JSON.parse(readFileSync(PROGRESS_FILE, "utf8")) };
  } catch (err) {
    console.error(`readProgress: unreadable ${PROGRESS_FILE}: ${err}`);
    return defaultProgressState();
  }
}

/** mtime of progress.json right now, or null if it doesn't exist yet — this file's stand-in for a
 *  revision number, cheap to get without parsing, and precise enough (ms resolution) for a
 *  single-user local app with at most a couple of writers active at once. */
function currentMtimeMs(): number | null {
  try {
    return statSync(PROGRESS_FILE).mtimeMs;
  } catch {
    return null;
  }
}

/** Thrown by writeProgress() when the file changed on disk since the caller read it — i.e. the
 *  web app's PUT /api/progress route (or, in principle, another MCP process) wrote in between.
 *  progress.json has THREE independent writers that can all touch it at any time (this process
 *  writing directly, the web app's browser tab debouncing its own PUTs, and the container's
 *  server.ts handling that PUT) with no lock between them. Without this check the incident this
 *  file is built around repeats itself in a different shape: not "the write silently vanished" but
 *  "the write succeeded, then a stale writer's next autosave silently overwrote it a moment later"
 *  — still data loss, still invisible unless something refuses the stale write outright. */
export class ProgressConflictError extends Error {
  constructor() {
    super(
      "progress.json changed on disk since it was last read — most likely the web app's browser tab " +
        "wrote its own (now-stale) copy concurrently. Refusing to overwrite it blindly.",
    );
    this.name = "ProgressConflictError";
  }
}

/** Always writes the whole object — no partial merges — matching the exact contract
 *  app/src/lib/progress.ts's updateProgress() and pipeline/src/server.ts's PUT route both honor.
 *  Same atomic tmp-file + rename pattern as server.ts:120-124.
 *
 *  `expectedMtimeMs` must be whatever currentProgressMtimeMs() (or a prior readProgress() call
 *  paired with it) returned *before* `next` was computed — pass it through updateProgress() below
 *  rather than calling this directly, so a conflict retries against fresh state instead of just
 *  failing once.
 *
 *  Also reads the file back and compares bytes before returning — the fix for a second, separate
 *  incident: a write can report success (no thrown error) while the bytes never actually land for
 *  any *other* process to see. A caller who only checks "did writeFileSync/renameSync throw" cannot
 *  detect that; only reading back what's actually on disk can. */
export function writeProgress(next: ProgressState, expectedMtimeMs: number | null): void {
  if (currentMtimeMs() !== expectedMtimeMs) throw new ProgressConflictError();

  mkdirSync(DATA_DIR, { recursive: true });
  const payload = JSON.stringify(next);
  const tmp = `${PROGRESS_FILE}.tmp-${process.pid}`;
  writeFileSync(tmp, payload, "utf8");
  renameSync(tmp, PROGRESS_FILE);

  const onDisk = readFileSync(PROGRESS_FILE, "utf8");
  if (onDisk !== payload) {
    throw new Error(
      `writeProgress: wrote ${PROGRESS_FILE} but the read-back doesn't match what was written, so the ` +
        `write did not actually persist. Nothing after this point (webapp, next session, readiness) will ` +
        `see this attempt. Reconnect/restart the snowprep-quiz MCP server and retry — do not treat this ` +
        `tool call as having succeeded.`,
    );
  }
}

type MutateResult<T> = { ok: true; next: ProgressState; value: T } | { ok: false; error: string };

/** Read-modify-write with automatic retry on a concurrent-writer conflict (see
 *  ProgressConflictError above). `mutate` receives freshly-read state on every attempt — including
 *  retries — so it must be a pure function of that state, never of anything captured earlier; a
 *  business-rule failure (e.g. "a session is already in progress") should return `{ok:false,...}`,
 *  which is returned immediately without retrying, since retrying can't fix that. Every session.ts
 *  write goes through this instead of calling readProgress()/writeProgress() directly. */
export function updateProgress<T>(
  mutate: (state: ProgressState) => MutateResult<T>,
  maxAttempts = 5,
): { ok: true; value: T } | { ok: false; error: string } {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const mtimeMs = currentMtimeMs();
    const state = readProgress();
    const result = mutate(state);
    if (!result.ok) return result;

    try {
      writeProgress(result.next, mtimeMs);
      return { ok: true, value: result.value };
    } catch (err) {
      if (err instanceof ProgressConflictError && attempt < maxAttempts) continue;
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { ok: false, error: "Could not persist progress after repeated concurrent-write conflicts." };
}

export function progressFilePath(): string {
  return PROGRESS_FILE;
}
