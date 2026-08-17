/**
 * Parses one domain's practice-question file (10-14) into Question records. Domain assignment
 * is unambiguous here — it comes straight from the filename, not from content — since each of
 * these files is 100% single-domain by construction.
 */

import type { ErrorCollector } from "../errors.js";
import type { Question } from "../types.js";
import { domainId, domainQuestionId } from "../util/ids.js";
import { parseQuestionFile } from "./questionCore.js";

export function parsePracticeQuestions(
  raw: string,
  filename: string,
  domainNumber: number,
  collector: ErrorCollector,
): Question[] {
  const domain = domainId(domainNumber);
  const parsed = parseQuestionFile(raw, filename, collector);

  return parsed.map((q) => ({
    id: domainQuestionId(domain, q.number),
    domainId: domain,
    type: q.multiSelect ? "multi" : "single",
    stem: q.stem,
    options: q.options,
    correct: q.correct,
    explanation: q.explanation,
    sourceFile: filename,
    sourceIndex: q.number,
  }));
}
