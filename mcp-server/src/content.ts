/**
 * Loads a fresh ContentBundle by calling the pipeline's own runPipeline() in-process — no HTTP
 * dependency on the Docker container being up, no duplicated markdown-parsing logic. Both
 * runPipeline() and resolveConfig() are confirmed pure (pipeline/src/index.ts, .../config.ts); the
 * latter's defaults are anchored to *its own* file location, so it resolves the real
 * SnowPro_Notes_and_Questions/ folder correctly regardless of where this file imports it from.
 *
 * stdio gotcha: StdioServerTransport uses stdout exclusively for JSON-RPC frames. printFailure()
 * (pipeline/src/report.ts) is stderr-only (console.error) and safe to reuse as-is; printNotices()/
 * printSuccess() both use console.log and would corrupt the protocol stream, so this file writes
 * its own one-line stderr summary on success instead of reusing them.
 */

import { resolveConfig } from "../../pipeline/src/config.js";
import { runPipeline } from "../../pipeline/src/index.js";
import { printFailure } from "../../pipeline/src/report.js";
import type { ContentBundle } from "../../pipeline/src/types.js";

export function loadBundle(): ContentBundle {
  const config = resolveConfig([]);
  const result = runPipeline(config);

  if (!result.success) {
    console.error("\n✗ Content pipeline failed — the MCP server cannot start.\n");
    printFailure(result.collector);
    process.exit(1);
  }

  const bundle = result.bundle!;
  console.error(
    `✓ Loaded ${bundle.questions.length} questions across ${bundle.domains.length} domains ` +
      `(bankVersion ${bundle.bankVersion}, source: ${config.sourceDir})`,
  );
  return bundle;
}
