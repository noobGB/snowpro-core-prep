/**
 * Readiness computation, per spec §4's "Derived numbers" table:
 *   - Domain readiness: `scaled` is an accuracy rate (0-1000) pooled across that domain's
 *     questions in the three most recent attempts touching it (practice and mock count equally).
 *     Blank until an attempt exists. This is domain-relative — a domain worth 10% of the exam and
 *     one worth 31% both read 1000 on a perfect run — so it stays the right signal for picking the
 *     weakest domain to study next (knowledge gap, not exam-weight size).
 *   - `maxPoints` is that domain's own slice of the 1000-point exam (its weight × 1000, e.g. a 31%
 *     domain owns 310) and `earnedPoints` is how much of that slice has actually been earned
 *     (accuracy rate × maxPoints). Both are always derived from `content.domains[].weight` and the
 *     live question-bank size — never hardcoded — so they track any change to domain weighting or
 *     question counts automatically.
 *   - Overall readiness sums `earnedPoints` across all domains and rescales against the sum of all
 *     `maxPoints` (nominally 1000, but computed rather than assumed, to absorb any rounding drift
 *     from per-domain weight → point conversion). Domains with no data yet contribute 0 earned
 *     points but still hold their max — they are NOT excluded and weights are NOT renormalized —
 *     so overall only rises as more of the whole exam gets covered, and a perfect score on one
 *     small domain can't inflate the headline number on its own. `measuredWeight` (sum of exam
 *     weight for domains with data) is reported separately for the "N% of the exam measured"
 *     caveat in the UI.
 *
 * "Touching" a domain means the attempt's set actually contained questions from it — every
 * domain-kind attempt touches exactly one domain (its own), every mock touches all five (mocks
 * always draw from every domain). Pooling credit + question-count across the 3 most recent
 * qualifying attempts (rather than averaging their individual scaled scores) is the literal
 * reading of "scaled score across the three most recent attempts."
 *
 * "Qualifying" also means the attempt's own `bankVersion` matches the currently-loaded content's
 * `bankVersion` — an attempt recorded against an older question bank is excluded entirely (not
 * counted toward the 3-attempt window, not pooled in), not just down-weighted. Without this, a
 * domain's practice-question pool growing later (new questions added to
 * SnowPro_Notes_and_Questions/) would retroactively shift old attempts' pooled accuracy even
 * though nothing about the original attempt actually changed — `domainQuestionCountInAttempt()`
 * always reads the *current* set size, so an old attempt's stored `credit` would silently get
 * divided by a denominator it was never actually measured against.
 */

import type { ContentBundle } from "./content";
import type { Attempt } from "./progress";

export interface DomainReadiness {
  domainId: string;
  scaled: number | null;
  earnedPoints: number | null;
  maxPoints: number;
  attemptsUsed: number;
  lowSample: boolean;
}

function domainWeight(content: ContentBundle, domainId: string): number {
  return content.domains.find((d) => d.id === domainId)?.weight ?? 0;
}

function domainQuestionCountInAttempt(content: ContentBundle, attempt: Attempt, domainId: string): number {
  const set = content.sets.find((s) => s.id === attempt.setId);
  if (!set) return 0;
  return set.kind === "mock" ? (set.domainSplit?.[domainId] ?? 0) : set.questionIds.length;
}

export function domainReadiness(content: ContentBundle, attempts: Attempt[], domainId: string): DomainReadiness {
  const domainSet = content.sets.find((s) => s.domainId === domainId && s.kind === "domain");
  const lowSample = (domainSet?.questionIds.length ?? 0) < 10;
  const maxPoints = Math.round(domainWeight(content, domainId) * 1000);

  const touching = attempts
    .filter((a) => a.byDomain[domainId] !== undefined && a.bankVersion === content.bankVersion)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 3);

  if (touching.length === 0) {
    return { domainId, scaled: null, earnedPoints: null, maxPoints, attemptsUsed: 0, lowSample };
  }

  let totalCredit = 0;
  let totalQuestions = 0;
  for (const a of touching) {
    totalCredit += a.byDomain[domainId]!.credit;
    totalQuestions += domainQuestionCountInAttempt(content, a, domainId);
  }

  const rate = totalQuestions > 0 ? totalCredit / totalQuestions : null;

  return {
    domainId,
    scaled: rate !== null ? Math.round(rate * 1000) : null,
    earnedPoints: rate !== null ? Math.round(rate * maxPoints) : null,
    maxPoints,
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

  const examMax = perDomain.reduce((sum, d) => sum + d.maxPoints, 0);
  const measuredWeight = measured.reduce((sum, d) => sum + domainWeight(content, d.domainId), 0);
  const earnedSum = perDomain.reduce((sum, d) => sum + (d.earnedPoints ?? 0), 0);

  return {
    overall: examMax > 0 ? Math.round((earnedSum / examMax) * 1000) : null,
    measuredWeight,
    perDomain,
  };
}

/**
 * Picks the domain most worth studying next: ascending by accuracy rate (`scaled`), with
 * never-attempted domains (`scaled === null`) treated as most urgent and sorted first. Ties
 * (e.g. everything untouched) fall back to `content.domains`' own order, so this isn't
 * hardcoded to "Domain 1" — it just happens to recommend whichever domain content.json lists
 * first until any domain has data, same as the MCP server's auto-pick.
 */
export function pickWeakestDomain(content: ContentBundle, attempts: Attempt[]): string | null {
  const readiness = overallReadiness(content, attempts);
  const sorted = [...readiness.perDomain].sort((a, b) => {
    if (a.scaled === null && b.scaled === null) return 0;
    if (a.scaled === null) return -1;
    if (b.scaled === null) return 1;
    return a.scaled - b.scaled;
  });
  return sorted[0]?.domainId ?? null;
}
