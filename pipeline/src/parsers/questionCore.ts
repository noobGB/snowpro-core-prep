/**
 * Shared line-based parser for the practice-question files (10-14) and the mock exam (16+).
 * These don't map cleanly onto generic markdown AST nodes — a "question" spans a bold stem
 * line, several option lines, and a separately-located answer-key entry matched by number — so
 * this is a small hand-written state machine over raw lines instead of an mdast walk.
 *
 * Handles, per the real files: options that wrap onto an indented continuation line; answer-key
 * explanation continuation lines whose indent width varies with the entry number's digit count
 * (don't hardcode a width); multi-select answers written "A and C" rather than concatenated
 * letters; and an optional inline "[Dx]" domain tag used only by the mock exam (see mockExam.ts).
 */

import type { ErrorCollector } from "../errors.js";
import type { QuestionOption } from "../types.js";

export interface ParsedQuestion {
  number: number;
  multiSelect: boolean;
  inlineDomainTag: string | null; // "D1".."D5", mock-exam only
  stem: string;
  options: QuestionOption[];
  correct: string[];
  explanation: string;
  startLine: number;
}

const STEM_RE = /^\*\*(\d+)\.(?:\s*\[(D[1-5])\])?(\s*\(Select TWO\))?\*\*\s*(.*)$/i;
const OPTION_RE = /^([A-E])\.\s+(.*)$/;
const CONTINUATION_RE = /^\s{2,}\S/;
const DIVIDER_RE = /^---\s*$/;
const ANSWER_KEY_HEADING_RE = /^##\s*Answer Key/i;
const ANSWER_ENTRY_RE = /^(\d+)\.\s*\*\*(.+?)\*\*\s*(.*)$/;

interface PendingQuestion {
  number: number;
  multiSelect: boolean;
  inlineDomainTag: string | null;
  stemLines: string[];
  options: Map<string, string>;
  lastOptionKey: string | null;
  startLine: number;
  awaitingFirstOption: boolean;
}

interface AnswerEntry {
  number: number;
  letters: string[];
  explanationLines: string[];
  line: number;
}

/** Splits a letter list like "C", "A and C", or the defensive "A, B and C" into option keys. */
function parseLetters(boldContent: string): string[] {
  const withoutTrailingPeriod = boldContent.replace(/\.\s*$/, "");
  const letterPart = withoutTrailingPeriod.split(/\s+—\s+/)[0]?.trim() ?? "";
  return letterPart
    .split(/\s*,\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => /^[A-E]$/.test(s));
}

function locateBlocks(lines: string[], filename: string, collector: ErrorCollector) {
  const dividerLines: number[] = [];
  let answerKeyHeadingIndex = -1;
  lines.forEach((line, i) => {
    if (DIVIDER_RE.test(line)) dividerLines.push(i);
    if (answerKeyHeadingIndex === -1 && ANSWER_KEY_HEADING_RE.test(line)) answerKeyHeadingIndex = i;
  });

  if (dividerLines.length < 2 || answerKeyHeadingIndex === -1) {
    collector.add({
      file: filename,
      itemRef: "structure",
      kind: "parse-error",
      message: `expected an intro '---' divider, question block, a second '---' divider, and '## Answer Key & Explanations' — found ${dividerLines.length} divider(s) and ${answerKeyHeadingIndex === -1 ? "no" : "an"} answer key heading`,
    });
    return null;
  }

  const dividersBeforeAnswerKey = dividerLines.filter((i) => i < answerKeyHeadingIndex);
  const questionBlockStart = (dividerLines[0] ?? 0) + 1;
  const questionBlockEndExclusive = dividersBeforeAnswerKey[dividersBeforeAnswerKey.length - 1] ?? answerKeyHeadingIndex;

  return {
    questionBlockStart,
    questionBlockEndExclusive,
    answerKeyStart: answerKeyHeadingIndex + 1,
  };
}

function scanQuestionBlock(
  lines: string[],
  start: number,
  endExclusive: number,
  filename: string,
  collector: ErrorCollector,
): PendingQuestion[] {
  const questions: PendingQuestion[] = [];
  let current: PendingQuestion | null = null;

  const finalize = () => {
    if (current) questions.push(current);
    current = null;
  };

  for (let i = start; i < endExclusive; i++) {
    const line = lines[i] ?? "";
    const lineNo = i + 1;

    if (current === null) {
      if (line.trim() === "") continue;
      const m = line.match(STEM_RE);
      if (!m) {
        collector.add({
          file: filename,
          itemRef: `line ${lineNo}`,
          line: lineNo,
          kind: "parse-error",
          message: `expected a question stem like "**N.** text" or "**N. (Select TWO)** text", got: ${JSON.stringify(line)}`,
        });
        continue;
      }
      current = {
        number: Number(m[1]),
        multiSelect: Boolean(m[3]),
        inlineDomainTag: m[2] ?? null,
        stemLines: [m[4] ?? ""],
        options: new Map(),
        lastOptionKey: null,
        startLine: lineNo,
        awaitingFirstOption: true,
      };
      continue;
    }

    const optMatch = line.match(OPTION_RE);
    if (optMatch) {
      const [, key, text] = optMatch;
      current.options.set(key!, text ?? "");
      current.lastOptionKey = key!;
      current.awaitingFirstOption = false;
      continue;
    }

    if (current.awaitingFirstOption) {
      // A blank line here is the normal markdown paragraph break between the stem and the
      // options list, not a boundary — the question only finalizes once options actually start
      // and then end (below). A malformed question with a *new* stem line and still zero
      // options is the one real "no options" case: finalize the broken one as an error and
      // start fresh, rather than silently swallowing its stem into the new question.
      if (line.trim() === "") continue;
      const newStem = line.match(STEM_RE);
      if (newStem) {
        collector.add({
          file: filename,
          itemRef: `Q${current.number}`,
          line: current.startLine,
          kind: "parse-error",
          message: `question ${current.number} has no options`,
        });
        current = {
          number: Number(newStem[1]),
          multiSelect: Boolean(newStem[3]),
          inlineDomainTag: newStem[2] ?? null,
          stemLines: [newStem[4] ?? ""],
          options: new Map(),
          lastOptionKey: null,
          startLine: lineNo,
          awaitingFirstOption: true,
        };
        continue;
      }
      current.stemLines.push(line.trim());
      continue;
    }

    if (CONTINUATION_RE.test(line) && current.lastOptionKey) {
      const key = current.lastOptionKey;
      current.options.set(key, `${current.options.get(key) ?? ""} ${line.trim()}`);
      continue;
    }

    if (line.trim() === "") {
      finalize();
      continue;
    }

    collector.add({
      file: filename,
      itemRef: `Q${current.number}`,
      line: lineNo,
      kind: "parse-error",
      message: `unexpected line inside question ${current.number}'s options block: ${JSON.stringify(line)}`,
    });
  }
  if (current?.awaitingFirstOption) {
    collector.add({
      file: filename,
      itemRef: `Q${current.number}`,
      line: current.startLine,
      kind: "parse-error",
      message: `question ${current.number} has no options`,
    });
    current = null;
  }
  finalize();

  return questions;
}

function scanAnswerKey(
  lines: string[],
  start: number,
  filename: string,
  collector: ErrorCollector,
): Map<number, AnswerEntry> {
  const entries = new Map<number, AnswerEntry>();
  let current: AnswerEntry | null = null;

  const finalize = () => {
    if (current) entries.set(current.number, current);
    current = null;
  };

  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineNo = i + 1;
    if (line.trim() === "") continue;

    const m = line.match(ANSWER_ENTRY_RE);
    if (m) {
      finalize();
      const [, numStr, boldContent, rest] = m;
      current = {
        number: Number(numStr),
        letters: parseLetters(boldContent ?? ""),
        explanationLines: [rest ?? ""],
        line: lineNo,
      };
      continue;
    }

    if (current) {
      current.explanationLines.push(line.trim());
    } else {
      collector.add({
        file: filename,
        itemRef: `line ${lineNo}`,
        line: lineNo,
        kind: "parse-error",
        message: `expected an answer key entry like "N. **LETTER.** explanation", got: ${JSON.stringify(line)}`,
      });
    }
  }
  finalize();

  return entries;
}

export function parseQuestionFile(
  raw: string,
  filename: string,
  collector: ErrorCollector,
): ParsedQuestion[] {
  const lines = raw.split(/\r?\n/);
  const blocks = locateBlocks(lines, filename, collector);
  if (!blocks) return [];

  const pending = scanQuestionBlock(
    lines,
    blocks.questionBlockStart,
    blocks.questionBlockEndExclusive,
    filename,
    collector,
  );
  const answerKey = scanAnswerKey(lines, blocks.answerKeyStart, filename, collector);

  const results: ParsedQuestion[] = [];
  for (const q of pending) {
    const entry = answerKey.get(q.number);
    if (!entry) {
      collector.add({
        file: filename,
        itemRef: `Q${q.number}`,
        line: q.startLine,
        kind: "parse-error",
        message: `no matching answer key entry found for question ${q.number}`,
      });
      continue;
    }

    const optionKeys = [...q.options.keys()].sort();
    const badLetters = entry.letters.filter((l) => !q.options.has(l));
    if (badLetters.length > 0) {
      collector.add({
        file: filename,
        itemRef: `Q${q.number}`,
        line: entry.line,
        kind: "parse-error",
        message: `answer key lists "${badLetters.join('", "')}" but only options ${optionKeys.join("–")} were found`,
      });
      continue;
    }

    const stemText = q.stemLines.join(" ").trim();
    const multiSelect = q.multiSelect || /\b(select|choose)\s+two\b/i.test(stemText);
    if (multiSelect !== entry.letters.length > 1) {
      collector.add({
        file: filename,
        itemRef: `Q${q.number}`,
        line: entry.line,
        kind: "parse-error",
        message: `question ${q.number} is marked ${multiSelect ? "multi-select" : "single-select"} but the answer key lists ${entry.letters.length} correct letter(s) (${entry.letters.join(", ")})`,
      });
      continue;
    }

    results.push({
      number: q.number,
      multiSelect,
      inlineDomainTag: q.inlineDomainTag,
      stem: stemText,
      options: optionKeys.map((key) => ({ key, text: (q.options.get(key) ?? "").trim() })),
      correct: entry.letters,
      explanation: entry.explanationLines.join(" ").trim(),
      startLine: q.startLine,
    });
  }

  return results;
}
