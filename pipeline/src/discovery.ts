/**
 * Classifies discovered markdown files by filename, per spec §5's discovery table. Files that
 * don't match any known pattern (e.g. 06_Practice_Exam_Tracker.md, the official-sample-questions
 * analysis, CLAUDE.md) are reported as skip notices rather than errors — "content grows, app
 * adapts," and the spec explicitly excludes an official-sample-questions page from v1.
 */

export type FileKind =
  | "domainNotes"
  | "practiceQuestions"
  | "mockExam"
  | "cheatsheet"
  | "studyPlan"
  | "resources"
  | "setupLog";

export interface ClassifiedFile {
  filename: string;
  kind: FileKind;
  /** Domain number for domainNotes/practiceQuestions; mock file number for mockExam. */
  number?: number;
}

// `number` always means "domain number" for domainNotes/practiceQuestions and "mock file number"
// for mockExam — practiceQuestions files (10-14) need +1 applied to the captured last digit
// (10 -> domain 1, ... 14 -> domain 5) so its meaning matches domainNotes' captured group directly.
const PATTERNS: Array<{ kind: FileKind; regex: RegExp; toNumber?: (captured: number) => number }> = [
  { kind: "domainNotes", regex: /^0([1-5])_Domain\d+_.*\.md$/i },
  { kind: "practiceQuestions", regex: /^1([0-4])_Practice_Questions_.*\.md$/i, toNumber: (n) => n + 1 },
  { kind: "mockExam", regex: /^(?:1[6-9]|[2-9]\d)_Mock_Exam_(\d+)\.md$/i },
  { kind: "cheatsheet", regex: /^08_Cheatsheet_.*\.md$/i },
  { kind: "studyPlan", regex: /^00_Study_Plan\.md$/i },
  { kind: "resources", regex: /^07_Resources\.md$/i },
  { kind: "setupLog", regex: /^15_Hands_On_.*\.md$/i },
];

export interface DiscoveryResult {
  classified: ClassifiedFile[];
  skipped: string[];
}

export function classifyFiles(filenames: string[]): DiscoveryResult {
  const classified: ClassifiedFile[] = [];
  const skipped: string[] = [];

  for (const filename of filenames) {
    let matched = false;
    for (const { kind, regex, toNumber } of PATTERNS) {
      const m = filename.match(regex);
      if (!m) continue;
      matched = true;
      const captured = m[1] !== undefined ? Number(m[1]) : undefined;
      const number = captured !== undefined ? (toNumber ? toNumber(captured) : captured) : undefined;
      classified.push({ filename, kind, number });
      break;
    }
    if (!matched) skipped.push(filename);
  }

  return { classified, skipped };
}
