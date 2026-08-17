/**
 * Writes content.json, notes/<domainId>.json, and search-index.json to a temp directory and
 * renames it into place, so a crash mid-write (e.g. disk full on the 3rd of 5 notes files)
 * can't leave a half-updated content/ directory. The temp dir is created as a sibling of the
 * output dir (same volume) — a rename across volumes on Windows silently falls back to
 * copy+delete, losing the atomicity guarantee this pattern exists for.
 *
 * If content/ already exists from a previous run, it's removed before the rename (a directory
 * rename can't atomically replace a non-empty existing directory on Windows) — this leaves a
 * brief window where the output doesn't exist, but the write itself, which is what actually
 * risks producing broken output, remains all-or-nothing.
 */

import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ContentBundle, DomainNotes, SearchIndexEntry } from "../types.js";

export function writeOutput(
  outputDir: string,
  bundle: ContentBundle,
  notesByDomain: Map<string, DomainNotes>,
  searchIndex: SearchIndexEntry[],
): void {
  const parent = path.dirname(outputDir);
  const tempDir = path.join(parent, `.tmp-content-${process.pid}`);

  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(path.join(tempDir, "notes"), { recursive: true });

  writeFileSync(path.join(tempDir, "content.json"), JSON.stringify(bundle, null, 2), "utf8");
  writeFileSync(path.join(tempDir, "search-index.json"), JSON.stringify(searchIndex, null, 2), "utf8");
  for (const notes of notesByDomain.values()) {
    writeFileSync(path.join(tempDir, "notes", `${notes.domainId}.json`), JSON.stringify(notes, null, 2), "utf8");
  }

  if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  renameSync(tempDir, outputDir);
}
