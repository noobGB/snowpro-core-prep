/**
 * Pure scoring functions, per spec §4's "Derived numbers" table. No React/storage dependency —
 * these just turn a question + picked option keys into credit, and a set of answers into a
 * scaled score, so they're trivially testable and reusable from both the runner and (later)
 * results/analytics.
 */

import type { Question } from "./content";

/** Single-answer: 1 or 0. Multi-select: (correct picked − incorrect picked) ÷ correct total,
 *  floored at 0. An unanswered question (picked = []) naturally scores 0 under both formulas —
 *  no special-casing needed for "unanswered counts as zero." */
export function questionCredit(question: Question, picked: string[]): number {
  if (question.type === "single") {
    return picked.length === 1 && picked[0] === question.correct[0] ? 1 : 0;
  }
  const correctSet = new Set(question.correct);
  const correctPicked = picked.filter((k) => correctSet.has(k)).length;
  const incorrectPicked = picked.filter((k) => !correctSet.has(k)).length;
  const credit = (correctPicked - incorrectPicked) / question.correct.length;
  return Math.max(0, credit);
}

/** round(credit ÷ answerable × 1000). "answerable" is the full set size, not just answered
 *  questions — an empty set can't be scored. */
export function scaledScore(totalCredit: number, answerableCount: number): number {
  if (answerableCount === 0) return 0;
  return Math.round((totalCredit / answerableCount) * 1000);
}

export interface DomainBreakdown {
  answered: number;
  credit: number;
  scaled: number;
}

/** Per-domain credit/scaled breakdown for an attempt's `byDomain` field. */
export function byDomainBreakdown(
  questions: Question[],
  answers: Record<string, string[]>,
): Record<string, DomainBreakdown> {
  const byDomain: Record<string, DomainBreakdown> = {};
  for (const q of questions) {
    const bucket = byDomain[q.domainId] ?? { answered: 0, credit: 0, scaled: 0 };
    const picked = answers[q.id] ?? [];
    if (picked.length > 0) bucket.answered += 1;
    bucket.credit += questionCredit(q, picked);
    byDomain[q.domainId] = bucket;
  }
  for (const [domainId, bucket] of Object.entries(byDomain)) {
    const domainQuestionCount = questions.filter((q) => q.domainId === domainId).length;
    bucket.scaled = scaledScore(bucket.credit, domainQuestionCount);
  }
  return byDomain;
}
