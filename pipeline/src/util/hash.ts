/**
 * Computes bankVersion: a real content hash, not a timestamp. The spec's own example
 * (`"bankVersion": "2026-08-16T09:12:00Z"`) conflates "a hash of all source files" with an ISO
 * timestamp, but those serve different purposes — a hash lets two attempts compare equal when
 * content hasn't changed (needed for "attempts run against an older bank" detection); a
 * timestamp would make every run "new" even with zero edits. So bankVersion is the hash, and a
 * sibling `generatedAt` field (see index.ts) carries the human-readable run time separately.
 */

import { createHash } from "node:crypto";
import type { SourceFile } from "./fs.js";

export function computeBankVersion(files: SourceFile[]): string {
  const hash = createHash("sha256");
  const sorted = [...files].sort((a, b) => a.filename.localeCompare(b.filename));
  for (const file of sorted) {
    // Path-prefixed so two files with identical content but different names can't collide.
    hash.update(file.filename);
    hash.update("\0");
    hash.update(file.raw, "utf8");
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
