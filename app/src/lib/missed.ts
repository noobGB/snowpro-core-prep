/**
 * Wrong-answer notebook index, per spec §6.3: "every question missed in any attempt... A
 * question leaves the notebook once it is answered correctly in a later attempt; a toggle keeps
 * history visible for anything ever missed." Built by walking attempts oldest -> newest so the
 * last write per question id is always its most recent occurrence.
 */

import type { ContentBundle, Question } from "./content";
import type { Attempt, AttemptAnswer } from "./progress";

export interface MissedEntry {
  question: Question;
  mostRecentAnswer: AttemptAnswer;
  mostRecentAttemptAt: string;
  /** False once the most recent attempt touching this question scored full credit. */
  currentlyMissed: boolean;
  /** True if any attempt ever scored less than full credit on this question. */
  everMissed: boolean;
}

export function buildMissedIndex(content: ContentBundle, attempts: Attempt[]): MissedEntry[] {
  const questionsById = new Map(content.questions.map((q) => [q.id, q]));
  const byQuestion = new Map<string, MissedEntry>();

  const oldestFirst = [...attempts].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  for (const attempt of oldestFirst) {
    for (const [qid, answer] of Object.entries(attempt.answers)) {
      const question = questionsById.get(qid);
      if (!question) continue;
      const prev = byQuestion.get(qid);
      byQuestion.set(qid, {
        question,
        mostRecentAnswer: answer,
        mostRecentAttemptAt: attempt.submittedAt,
        currentlyMissed: answer.credit < 1,
        everMissed: (prev?.everMissed ?? false) || answer.credit < 1,
      });
    }
  }

  return [...byQuestion.values()].sort((a, b) => b.mostRecentAttemptAt.localeCompare(a.mostRecentAttemptAt));
}
