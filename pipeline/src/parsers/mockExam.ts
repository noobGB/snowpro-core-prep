/**
 * Parses a mock exam file into Question records, resolving each question's domainId — the real
 * gap against spec §5's assumption that "domain assignment comes from the file's own domain
 * headings." The real mock file has no such headings: it interleaves questions by design, with
 * 50 of 100 being verbatim duplicates of domain-file questions (resolved via stem-normalized
 * dedup, reusing the existing question's id) and the rest requiring an inline "[Dx]" tag added
 * directly to the markdown (see the plan's "Mock exam domain tagging" section). Anything with
 * neither is collected — not thrown on the first failure — so one run reports every unresolved
 * question at once.
 */

import type { ErrorCollector } from "../errors.js";
import type { Question } from "../types.js";
import { mockOnlyQuestionId } from "../util/ids.js";
import { normalizeStem } from "../util/stem.js";
import { parseQuestionFile } from "./questionCore.js";

export interface MockParseResult {
  /** Newly minted questions (mock-only, resolved via inline tag) — callers add these to the
   *  global questions[] list. Deduped questions are NOT included here since they already exist. */
  newQuestions: Question[];
  /** Every question's resolved id, in the mock file's own order — becomes the mock set's
   *  questionIds. Empty if any question was unresolved (collector will be non-empty in that case). */
  questionIdsInOrder: string[];
}

export function parseMockExam(
  raw: string,
  filename: string,
  mockFileNumber: number,
  domainQuestionPool: Question[],
  collector: ErrorCollector,
): MockParseResult {
  const parsed = parseQuestionFile(raw, filename, collector);

  const stemLookup = new Map<string, Question>();
  for (const q of domainQuestionPool) {
    stemLookup.set(normalizeStem(q.stem), q);
  }

  const newQuestions: Question[] = [];
  const questionIdsInOrder: string[] = [];
  const unresolved: Array<{ number: number; line: number; stemPreview: string }> = [];

  for (const q of parsed) {
    const match = stemLookup.get(normalizeStem(q.stem));
    if (match) {
      questionIdsInOrder.push(match.id);
      continue;
    }

    if (q.inlineDomainTag) {
      const domain = q.inlineDomainTag.toLowerCase();
      const id = mockOnlyQuestionId(mockFileNumber, q.number);
      const question: Question = {
        id,
        domainId: domain,
        type: q.multiSelect ? "multi" : "single",
        stem: q.stem,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation,
        sourceFile: filename,
        sourceIndex: q.number,
      };
      newQuestions.push(question);
      questionIdsInOrder.push(id);
      continue;
    }

    unresolved.push({
      number: q.number,
      line: q.startLine,
      stemPreview: q.stem.slice(0, 80),
    });
  }

  for (const u of unresolved) {
    collector.add({
      file: filename,
      itemRef: `Q${u.number}`,
      line: u.line,
      kind: "unresolved-domain",
      message: `no domainId could be determined — question text ("${u.stemPreview}...") does not match any domain-file question by normalized stem, and no inline domain tag like "**${u.number}. [D3]**" was found.`,
    });
  }

  return {
    newQuestions,
    questionIdsInOrder: unresolved.length > 0 ? [] : questionIdsInOrder,
  };
}

const DURATION_RE = /(\d+)\s*minutes/i;
const STATED_SPLIT_RE = /Domain\s*(\d)[^:]*:\s*(\d+)/g;

export interface MockMeta {
  title: string;
  durationMin: number;
  /** domainId -> count, parsed from the mock's own intro prose ("Domain 1 (...): 31, ..."),
   *  kept only for validate.ts's cross-check against the pipeline's own computed split — never
   *  used as the source of truth for domainSplit itself. */
  statedDomainSplit: Record<string, number> | null;
}

export function parseMockMeta(raw: string, mockFileNumber: number): MockMeta {
  const durationMatch = raw.match(DURATION_RE);
  const durationMin = durationMatch ? Number(durationMatch[1]) : 115;

  const statedDomainSplit: Record<string, number> = {};
  let found = false;
  for (const m of raw.matchAll(STATED_SPLIT_RE)) {
    found = true;
    statedDomainSplit[`d${m[1]}`] = Number(m[2]);
  }

  return {
    title: `Mock Exam ${mockFileNumber}`,
    durationMin,
    statedDomainSplit: found ? statedDomainSplit : null,
  };
}
