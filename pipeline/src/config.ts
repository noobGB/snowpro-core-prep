/**
 * Resolves the pipeline's runtime configuration: source markdown directory, output directory,
 * and the strict-mocks flag. Priority order for each is CLI flag > env var > default, so the
 * same code path works unchanged whether it's run by hand today or, later, inside the Docker
 * container against the mounted /content and /data volumes (spec §9) — only the env vars change.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const PIPELINE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEBAPP_ROOT = path.dirname(PIPELINE_ROOT);
const DEFAULT_SOURCE_DIR = path.resolve(WEBAPP_ROOT, "SnowPro_Notes_and_Questions");
const DEFAULT_OUTPUT_DIR = path.resolve(WEBAPP_ROOT, "content");

export interface PipelineConfig {
  sourceDir: string;
  outputDir: string;
  /** Fail loudly on any mock question whose domain can't be resolved. Kept as a flag (rather
   *  than hardcoded true) so a future partial-preview mode isn't a breaking change — there is
   *  no reason to run with this off in v1. */
  strictMocks: boolean;
}

function readFlag(args: string[], name: string): string | undefined {
  const withEquals = args.find((a) => a.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(`--${name}=`.length);
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

export function resolveConfig(argv: string[] = process.argv.slice(2)): PipelineConfig {
  const sourceDir =
    readFlag(argv, "source") ?? process.env.SNOWPRO_CONTENT_SOURCE ?? DEFAULT_SOURCE_DIR;
  const outputDir =
    readFlag(argv, "output") ?? process.env.SNOWPRO_CONTENT_OUTPUT ?? DEFAULT_OUTPUT_DIR;
  const strictMocks = !argv.includes("--no-strict-mocks");

  return {
    sourceDir: path.resolve(sourceDir),
    outputDir: path.resolve(outputDir),
    strictMocks,
  };
}
