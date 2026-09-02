/**
 * Assembles sets[]: one "domain" set per domain (scoped to that domain's own practice-question
 * file, not every question ever tagged with that domain — mock-only-tagged questions exist
 * solely to make the mock's domainSplit accurate and don't get a second home here) and one
 * "mock" set per discovered mock file, with a computed (never hardcoded) domainSplit.
 */

import { classifyFiles } from "../discovery.js";
import type { Domain, MockDifficulty, Question, QuestionSet } from "../types.js";
import { domainSetId, mockSetId } from "../util/ids.js";

function isDomainAuthored(question: Question): boolean {
  const [file] = classifyFiles([question.sourceFile]).classified;
  return file?.kind === "practiceQuestions";
}

export function buildDomainSets(domains: Domain[], questions: Question[]): QuestionSet[] {
  return domains.map((d) => {
    const questionIds = questions
      .filter((q) => q.domainId === d.id && isDomainAuthored(q))
      .sort((a, b) => a.sourceIndex - b.sourceIndex)
      .map((q) => q.id);
    return {
      id: domainSetId(d.id),
      kind: "domain",
      domainId: d.id,
      title: `Domain ${d.number} — ${d.title}`,
      questionIds,
      timed: false,
    };
  });
}

export interface MockSetInput {
  mockFileNumber: number;
  title: string;
  durationMin: number;
  difficulty: MockDifficulty;
  questionIdsInOrder: string[];
}

export function buildMockSet(input: MockSetInput, allQuestions: Question[]): QuestionSet {
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  const domainSplit: Record<string, number> = {};
  for (const id of input.questionIdsInOrder) {
    const domain = byId.get(id)?.domainId;
    if (!domain) continue;
    domainSplit[domain] = (domainSplit[domain] ?? 0) + 1;
  }

  return {
    id: mockSetId(input.mockFileNumber),
    kind: "mock",
    title: input.title,
    questionIds: input.questionIdsInOrder,
    timed: true,
    durationMin: input.durationMin,
    difficulty: input.difficulty,
    domainSplit,
  };
}
