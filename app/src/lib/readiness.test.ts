/**
 * Tests for readiness.ts's cumulative-points model — see that file's own doc comment for the
 * intended behavior each case below is pinned to (pooling across the 3 most recent qualifying
 * attempts, the maxPoints/earnedPoints derivation, unmeasured domains holding their max without
 * renormalization, and pickWeakestDomain()'s null-sorts-first tie-breaking).
 */

import { describe, expect, it } from "vitest";
import { domainReadiness, overallReadiness, pickWeakestDomain } from "./readiness";
import type { ContentBundle, Domain, QuestionSet } from "./content";
import type { Attempt } from "./progress";

/** A domain-kind set with `count` question ids — 10 by default so `lowSample` (<10) never fires
 *  and doesn't interfere with the assertions below, which are about pooling/rounding, not that flag. */
function makeDomainSet(domainId: string, count = 10): QuestionSet {
  return {
    id: `set-${domainId}`,
    kind: "domain",
    domainId,
    title: `${domainId} set`,
    questionIds: Array.from({ length: count }, (_, i) => `${domainId}-q${i + 1}`),
    timed: false,
  };
}

function makeMockSet(domainSplit: Record<string, number>): QuestionSet {
  const questionIds = Object.entries(domainSplit).flatMap(([domainId, n]) =>
    Array.from({ length: n }, (_, i) => `${domainId}-mock-q${i + 1}`),
  );
  return {
    id: "mock-1",
    kind: "mock",
    title: "Mock 1",
    questionIds,
    timed: true,
    durationMin: 115,
    domainSplit,
  };
}

function makeDomain(id: string, weight: number): Domain {
  return { id, number: 1, title: id, weight, noteFile: `${id}.md`, sections: [] };
}

/** Builds a bundle with one domain-kind set per domain (10 questions each, unless overridden via
 *  `domainSetSizes`) plus one mock set that draws 5 questions from each listed domain — enough
 *  surface for both "domain attempt" and "mock attempt" pooling cases below.
 *
 *  Note: a domain-kind attempt's question count comes from its *set's* full `questionIds.length`
 *  (domainQuestionCountInAttempt in readiness.ts), not from the attempt's own `answered` field —
 *  a domain quiz is always assumed to cover its whole set. `domainSetSizes` exists so a test that
 *  needs a specific denominator (e.g. 3, for a 1/3 rounding case) can set it directly. */
function makeContent(domainWeights: Record<string, number>, domainSetSizes: Record<string, number> = {}): ContentBundle {
  const domains = Object.entries(domainWeights).map(([id, weight]) => makeDomain(id, weight));
  const domainSets = domains.map((d) => makeDomainSet(d.id, domainSetSizes[d.id] ?? 10));
  const mockSplit = Object.fromEntries(domains.map((d) => [d.id, 5]));
  return {
    bankVersion: "sha256:test",
    generatedAt: new Date().toISOString(),
    generatedFrom: [],
    domains,
    questions: [],
    sets: [...domainSets, makeMockSet(mockSplit)],
    flashcards: [],
    plan: [],
    resources: [],
    setup: [],
  };
}

let attemptSeq = 0;

function makeAttempt(overrides: Partial<Attempt> & { byDomain: Attempt["byDomain"] }): Attempt {
  attemptSeq += 1;
  // Zero-padded so string comparison (localeCompare) sorts the same as chronological order.
  const submittedAt = overrides.submittedAt ?? `2026-01-${String(attemptSeq).padStart(2, "0")}T00:00:00.000Z`;
  return {
    id: `a${attemptSeq}`,
    setId: "set-d1",
    kind: "domain",
    bankVersion: "sha256:test",
    startedAt: submittedAt,
    status: "complete",
    durationSec: 600,
    answers: {},
    scaled: 0,
    rawPct: 0,
    ...overrides,
    submittedAt,
  };
}

describe("domainReadiness", () => {
  it("pools credit and question counts across attempts, including a mix of domain and mock kinds", () => {
    const content = makeContent({ d1: 0.6, d2: 0.4 });
    const attempts: Attempt[] = [
      makeAttempt({ setId: "set-d1", kind: "domain", byDomain: { d1: { answered: 10, credit: 6, scaled: 600 } } }),
      makeAttempt({ setId: "mock-1", kind: "mock", byDomain: { d1: { answered: 5, credit: 3, scaled: 600 } } }),
      makeAttempt({ setId: "set-d1", kind: "domain", byDomain: { d1: { answered: 10, credit: 5, scaled: 500 } } }),
    ];

    const result = domainReadiness(content, attempts, "d1");

    // totalCredit = 6 + 3 + 5 = 14; totalQuestions = 10 (domain set) + 5 (mock domainSplit.d1) + 10 = 25.
    expect(result.attemptsUsed).toBe(3);
    expect(result.scaled).toBe(Math.round((14 / 25) * 1000)); // 560
    expect(result.maxPoints).toBe(600); // round(0.6 * 1000)
    expect(result.earnedPoints).toBe(Math.round((14 / 25) * 600)); // 336
  });

  it("caps pooling at the 3 most recent qualifying attempts, excluding an older 4th", () => {
    const content = makeContent({ d1: 0.5, d2: 0.5 });
    const attempts: Attempt[] = [
      // Oldest, deliberately terrible — must NOT be pooled in once a 4th attempt exists.
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 10, credit: 0, scaled: 0 } } }),
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 10, credit: 10, scaled: 1000 } } }),
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 10, credit: 10, scaled: 1000 } } }),
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 10, credit: 10, scaled: 1000 } } }),
    ];

    const result = domainReadiness(content, attempts, "d1");

    expect(result.attemptsUsed).toBe(3);
    // If the oldest 0-credit attempt were included: 30 / 40 = 750. Excluded, it's a perfect 1000.
    expect(result.scaled).toBe(1000);
  });

  it("rounds scaled and earnedPoints independently on a non-terminating fraction", () => {
    // Mirrors CLAUDE.md's own documented example: a 31%-weight domain at 1/3 accuracy reads
    // "333 / 1000" domain-relative and "103 pts / 310" weight-scaled. d1's set is sized to 3
    // questions so the pooled rate lands exactly on 1/3 (see makeContent's doc comment on why the
    // denominator comes from the set size, not attempt.answered).
    const content = makeContent({ d1: 0.31, d2: 0.69 }, { d1: 3 });
    const attempts: Attempt[] = [
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 3, credit: 1, scaled: 333 } } }),
    ];

    const result = domainReadiness(content, attempts, "d1");

    expect(result.maxPoints).toBe(310);
    expect(result.scaled).toBe(333); // round(1/3 * 1000)
    expect(result.earnedPoints).toBe(103); // round(1/3 * 310) = round(103.33...)
  });

  it("rounds up (not down) once the fractional part reaches .5 — pins the direction, not just 'some rounding happens'", () => {
    // 1/3's fraction (.333) rounds the same way under floor/round/ceil, so it can't by itself
    // catch e.g. Math.round silently regressing to Math.floor. 1/6 = .1666... does distinguish
    // them: 1000/6 = 166.66 (round -> 167, floor -> 166) and, with maxPoints 550, 550/6 = 91.66
    // (round -> 92, floor -> 91).
    const content = makeContent({ d1: 0.55, d2: 0.45 }, { d1: 6 });
    const attempts: Attempt[] = [
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 6, credit: 1, scaled: 167 } } }),
    ];

    const result = domainReadiness(content, attempts, "d1");

    expect(result.maxPoints).toBe(550);
    expect(result.scaled).toBe(167);
    expect(result.earnedPoints).toBe(92);
  });

  it("returns nulls and zero attemptsUsed when no attempt has touched the domain", () => {
    const content = makeContent({ d1: 0.5, d2: 0.5 });
    const result = domainReadiness(content, [], "d1");
    expect(result.scaled).toBeNull();
    expect(result.earnedPoints).toBeNull();
    expect(result.attemptsUsed).toBe(0);
    expect(result.maxPoints).toBe(500);
  });
});

describe("overallReadiness", () => {
  it("returns overall: null when no domain has any data", () => {
    const content = makeContent({ d1: 0.6, d2: 0.4 });
    const result = overallReadiness(content, []);
    expect(result.overall).toBeNull();
    expect(result.measuredWeight).toBe(0);
    expect(result.perDomain).toHaveLength(2);
  });

  it("does not renormalize: an unmeasured domain contributes 0 but still holds its own maxPoints", () => {
    const content = makeContent({ d1: 0.6, d2: 0.4 });
    // Only d1 has data, and it's a perfect score.
    const attempts: Attempt[] = [
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 10, credit: 10, scaled: 1000 } } }),
    ];

    const result = overallReadiness(content, attempts);

    // If d2's weight were renormalized away, overall would read 1000 (d1 alone, at 100%).
    // Un-renormalized: earnedSum = 600 (d1's full maxPoints) + 0 (d2) = 600, over examMax 1000.
    expect(result.overall).toBe(600);
    expect(result.measuredWeight).toBeCloseTo(0.6);
    const d2 = result.perDomain.find((d) => d.domainId === "d2")!;
    expect(d2.scaled).toBeNull();
    expect(d2.earnedPoints).toBeNull();
    expect(d2.maxPoints).toBe(400);
  });
});

describe("pickWeakestDomain", () => {
  it("falls back to content.domains' own order when every domain is untouched (all null ties)", () => {
    // d2 listed before d1 on purpose, to prove the tie-break is list order, not id/alpha order.
    const content = makeContent({ d2: 0.5, d1: 0.5 });
    expect(pickWeakestDomain(content, [])).toBe("d2");
  });

  it("treats a never-attempted domain (scaled === null) as more urgent than an attempted domain with a literal 0 score", () => {
    const content = makeContent({ d1: 0.5, d2: 0.5 });
    const attempts: Attempt[] = [
      // d1 has been attempted and scored the worst possible measured result.
      makeAttempt({ setId: "set-d1", byDomain: { d1: { answered: 10, credit: 0, scaled: 0 } } }),
      // d2 has never been attempted at all.
    ];
    expect(pickWeakestDomain(content, attempts)).toBe("d2");
  });
});
