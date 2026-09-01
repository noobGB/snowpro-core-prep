/**
 * Tests for computeBankVersion()'s line-ending normalization — a Windows checkout (core.autocrlf
 * true) and the Linux CI runner that builds the deployed image see byte-different content for the
 * exact same commit (CRLF vs LF), which produced two different bankVersions for what git itself
 * considers identical content. See hash.ts's own doc comment for the full incident.
 */

import { describe, expect, it } from "vitest";
import { computeBankVersion } from "../src/util/hash.js";
import type { SourceFile } from "../src/util/fs.js";

function file(filename: string, raw: string): SourceFile {
  return { filename, path: `/fake/${filename}`, raw };
}

describe("computeBankVersion", () => {
  it("produces the identical hash for CRLF and LF line endings of the same content", () => {
    const lf = computeBankVersion([file("01_Domain1.md", "line one\nline two\nline three\n")]);
    const crlf = computeBankVersion([file("01_Domain1.md", "line one\r\nline two\r\nline three\r\n")]);
    expect(lf).toBe(crlf);
  });

  it("still produces different hashes for genuinely different content", () => {
    const a = computeBankVersion([file("01_Domain1.md", "line one\nline two\n")]);
    const b = computeBankVersion([file("01_Domain1.md", "line one\nline TWO\n")]);
    expect(a).not.toBe(b);
  });

  it("is order-independent across files, matching the existing sort-by-filename behavior", () => {
    const a = computeBankVersion([file("02_Domain2.md", "b\r\n"), file("01_Domain1.md", "a\n")]);
    const b = computeBankVersion([file("01_Domain1.md", "a\r\n"), file("02_Domain2.md", "b\n")]);
    expect(a).toBe(b);
  });
});
