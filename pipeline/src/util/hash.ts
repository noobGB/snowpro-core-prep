/**
 * Computes bankVersion: a real content hash, not a timestamp. The spec's own example
 * (`"bankVersion": "2026-08-16T09:12:00Z"`) conflates "a hash of all source files" with an ISO
 * timestamp, but those serve different purposes — a hash lets two attempts compare equal when
 * content hasn't changed (needed for "attempts run against an older bank" detection); a
 * timestamp would make every run "new" even with zero edits. So bankVersion is the hash, and a
 * sibling `generatedAt` field (see index.ts) carries the human-readable run time separately.
 *
 * Line endings are normalized to LF before hashing, deliberately — this isn't cosmetic. Git's
 * `core.autocrlf=true` (a common Windows setting) checks markdown files out with CRLF locally,
 * while the GitHub Actions Linux runner that builds the deployed image checks the exact same
 * commit out with LF. Hashing raw, un-normalized bytes made two genuinely byte-for-byte-identical
 * (per `git diff`) content trees produce two different bankVersions purely because of which OS did
 * the checkout — confirmed directly: a Windows-built local instance and the Railway deployment of
 * the same commit reported different hashes. The practical fallout: readiness.ts's attempt-pooling
 * filters strictly on `attempt.bankVersion === content.bankVersion`, so every attempt recorded
 * against the "wrong" platform's hash — including a legitimate export/import between a local
 * instance and the public deployment — silently vanished from readiness with no error anywhere.
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
    hash.update(file.raw.replace(/\r\n/g, "\n"), "utf8");
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
