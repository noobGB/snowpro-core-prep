/**
 * Slowest-question aggregation for Analytics' timing view (spec §6.9). Per-question `timeSec` is
 * recorded by the runner as elapsed-since-session-start at last answer, not true viewport-entry
 * timing (see Runner.tsx) — a known simplification, but real recorded data nonetheless.
 */

import type { ContentBundle } from "./content";
import type { Attempt } from "./progress";

export interface SlowQuestion {
  questionId: string;
  domainId: string;
  stem: string;
  timeSec: number;
  attemptId: string;
}

export function slowestQuestions(content: ContentBundle, attempts: Attempt[], limit = 10): SlowQuestion[] {
  const questionsById = new Map(content.questions.map((q) => [q.id, q]));
  const all: SlowQuestion[] = [];
  for (const attempt of attempts) {
    for (const [qid, answer] of Object.entries(attempt.answers)) {
      const question = questionsById.get(qid);
      if (!question || answer.timeSec <= 0) continue;
      all.push({ questionId: qid, domainId: question.domainId, stem: question.stem, timeSec: answer.timeSec, attemptId: attempt.id });
    }
  }
  return all.sort((a, b) => b.timeSec - a.timeSec).slice(0, limit);
}
