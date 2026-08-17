/**
 * Thin filesystem helpers: list markdown files in the source directory and read them as UTF-8.
 * Source files use plain UTF-8 characters (em dashes, arrows, ×, ≈, ≥) throughout — never read
 * with a latin-1/cp1252 fallback, or those bytes corrupt on the way in.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface SourceFile {
  filename: string; // basename only, e.g. "16_Mock_Exam_1.md"
  path: string; // absolute path
  raw: string; // UTF-8 text content
}

export function listMarkdownFiles(sourceDir: string): string[] {
  return readdirSync(sourceDir)
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));
}

export function readSourceFile(sourceDir: string, filename: string): SourceFile {
  const filePath = path.join(sourceDir, filename);
  const raw = readFileSync(filePath, "utf8");
  return { filename, path: filePath, raw };
}
