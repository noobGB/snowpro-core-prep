/**
 * Readiness computation, per spec §4's "Derived numbers" table:
 *   - Domain readiness: scaled score pooled across that domain's questions in the three most
 *     recent attempts touching it (practice and mock count equally). Blank until an attempt
 *     exists.
 *   - Overall readiness: domain readiness weighted 31/21/20/18/10; domains with no data are
 *     excluded and the remaining weights renormalized.
 *
 * "Touching" a domain means the attempt's set actually contained questions from it — every
 * domain-kind attempt touches exactly one domain (its own), every mock touches all five (mocks
 * always draw from every domain). Pooling credit + question-count across the 3 most recent
 * qualifying attempts (rather than averaging their individual scaled scores) is the literal
 * reading of "scaled score across the three most recent attempts."
 */

import type { ContentBundle } from "./content";
import type { Attempt } from "./progress";

export interface DomainReadiness {
  domainId: string;
  scaled: number | null;
  attemptsUsed: number;
  lowSample: boolean;
}

function domainQuestionCountInAttempt(content: ContentBundle, attempt: Attempt, domainId: string): number {
  const set = content.sets.find((s) => s.id === attempt.setId);
  if (!set) return 0;
  return set.kind === "mock" ? (set.domainSplit?.[domainId] ?? 0) : set.questionIds.length;
}

export function domainReadiness(content: ContentBundle, attempts: Attempt[], domainId: string): DomainReadiness {
  const domainSet = content.sets.find((s) => s.domainId === domainId && s.kind === "domain");
  const lowSample = (domainSet?.questionIds.length ?? 0) < 10;

  const touching = attempts
    .filter((a) => a.byDomain[domainId] !== undefined)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 3);

  if (touching.length === 0) return { domainId, scaled: null, attemptsUsed: 0, lowSample };

  let totalCredit = 0;
  let totalQuestions = 0;
  for (const a of touching) {
    totalCredit += a.byDomain[domainId]!.credit;
    totalQuestions += domainQuestionCountInAttempt(content, a, domainId);
  }

  return {
    domainId,
    scaled: totalQuestions > 0 ? Math.round((totalCredit / totalQuestions) * 1000) : null,
    attemptsUsed: touching.length,
    lowSample,
  };
}

export interface OverallReadiness {
  overall: number | null;
  measuredWeight: number;
  perDomain: DomainReadiness[];
}

export function overallReadiness(content: ContentBundle, attempts: Attempt[]): OverallReadiness {
  const perDomain = content.domains.map((d) => domainReadiness(content, attempts, d.id));
  const measured = perDomain.filter((d) => d.scaled !== null);
  if (measured.length === 0) return { overall: null, measuredWeight: 0, perDomain };

  const weightOf = (domainId: string) => content.domains.find((d) => d.id === domainId)?.weight ?? 0;
  const totalWeight = measured.reduce((sum, d) => sum + weightOf(d.domainId), 0);
  const weightedSum = measured.reduce((sum, d) => sum + (d.scaled ?? 0) * weightOf(d.domainId), 0);

  return {
    overall: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null,
    measuredWeight: totalWeight,
    perDomain,
  };
}
