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

/**
 * One row per distinct question ever attempted (Practice or Mock) — deliberately not one row per
 * (question, attempt) pair. A question answered more than once keeps only its most recently
 * recorded timeSec: a retake supersedes an older recorded time for the same question rather than
 * both coexisting, which also means a stale/corrupted value (see issue #81's original bug, where
 * every question in an attempt was wrongly stamped with the same submit-time total) gets replaced
 * the moment that question is answered again post-fix, instead of permanently out-ranking correct
 * data in the sort below. Sorted slowest-first, uncapped — the caller renders this inside a
 * scrollable container rather than truncating to a fixed count.
 */
export function slowestQuestions(content: ContentBundle, attempts: Attempt[]): SlowQuestion[] {
  const questionsById = new Map(content.questions.map((q) => [q.id, q]));
  const latestByQuestion = new Map<string, SlowQuestion>();
  const byRecency = [...attempts].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  for (const attempt of byRecency) {
    for (const [qid, answer] of Object.entries(attempt.answers)) {
      const question = questionsById.get(qid);
      if (!question || answer.timeSec <= 0) continue;
      latestByQuestion.set(qid, { questionId: qid, domainId: question.domainId, stem: question.stem, timeSec: answer.timeSec, attemptId: attempt.id });
    }
  }
  return [...latestByQuestion.values()].sort((a, b) => b.timeSec - a.timeSec);
}
