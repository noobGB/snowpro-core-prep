/**
 * Collected-error reporting for the content pipeline. Every parser and validation stage appends
 * to one shared ErrorCollector instance instead of throwing on the first problem it finds, so a
 * single run can report every issue across every file in one pass (spec §5's fail-loud rule:
 * "a partial import is never produced" — nothing is written while the collector is non-empty).
 *
 * Only genuine I/O failures (a source file can't be read at all) should throw directly; those
 * mean the run cannot proceed, which is a different situation from "this file has bad content."
 */

export type ContentErrorKind = "parse-error" | "unresolved-domain";

export interface ContentError {
  file: string;
  /** e.g. "Q37", "H1", "3.1", "row 4" — whatever identifies the offending item within the file. */
  itemRef: string;
  line?: number;
  message: string;
  kind: ContentErrorKind;
}

export class ErrorCollector {
  private errors: ContentError[] = [];

  add(error: ContentError): void {
    this.errors.push(error);
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  get all(): ContentError[] {
    return this.errors;
  }

  /** Groups errors by file (sorted by filename, then by line/itemRef within each file) for the
   *  human-readable failure report. */
  groupedByFile(): Array<{ file: string; errors: ContentError[] }> {
    const byFile = new Map<string, ContentError[]>();
    for (const err of this.errors) {
      const list = byFile.get(err.file) ?? [];
      list.push(err);
      byFile.set(err.file, list);
    }
    return [...byFile.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, errors]) => ({
        file,
        errors: [...errors].sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
      }));
  }
}
