/**
 * Tests for scoring.ts's pure credit/scaling math — the same formulas the runner, results page,
 * and readiness.ts's pooling all depend on. See scoring.ts's own doc comments for the intended
 * behavior each test below is pinned to.
 */

import { describe, expect, it } from "vitest";
import { byDomainBreakdown, questionCredit, scaledScore } from "./scoring";
import type { Question } from "./content";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    domainId: "d1",
    type: "single",
    stem: "stem",
    options: [
      { key: "A", text: "a" },
      { key: "B", text: "b" },
    ],
    correct: ["A"],
    explanation: "e",
    sourceFile: "10.md",
    sourceIndex: 1,
    ...overrides,
  };
}

describe("questionCredit", () => {
  it("awards 1 for a single-answer question with the correct option picked", () => {
    const q = makeQuestion({ type: "single", correct: ["A"] });
    expect(questionCredit(q, ["A"])).toBe(1);
  });

  it("awards 0 for a single-answer question with a wrong option picked", () => {
    const q = makeQuestion({ type: "single", correct: ["A"] });
    expect(questionCredit(q, ["B"])).toBe(0);
  });

  it("awards 0 for an unanswered single-answer question", () => {
    const q = makeQuestion({ type: "single", correct: ["A"] });
    expect(questionCredit(q, [])).toBe(0);
  });

  it("awards 0 for a single-answer question with more than one option picked", () => {
    // picked.length !== 1 fails the single-answer check even if the correct key is among them.
    const q = makeQuestion({ type: "single", correct: ["A"] });
    expect(questionCredit(q, ["A", "B"])).toBe(0);
  });

  it("scores a multi-select question as (correctPicked - incorrectPicked) / correctTotal", () => {
    const q = makeQuestion({ type: "multi", correct: ["A", "B", "C"] });
    expect(questionCredit(q, ["A", "B"])).toBeCloseTo(2 / 3);
  });

  it("scores a fully wrong multi-select pick as exactly 0, not negative", () => {
    const q = makeQuestion({ type: "multi", correct: ["A"], options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }] });
    // 0 correct picked, 2 incorrect picked -> (0 - 2) / 1 = -2, floored to 0.
    expect(questionCredit(q, ["B", "C"])).toBe(0);
  });

  it("nets correct and incorrect picks for a partial multi-select answer", () => {
    const q = makeQuestion({
      type: "multi",
      correct: ["A", "B", "C"],
      options: [
        { key: "A", text: "a" },
        { key: "B", text: "b" },
        { key: "C", text: "c" },
        { key: "D", text: "d" },
      ],
    });
    // 3 correct picked, 1 incorrect picked -> (3 - 1) / 3.
    expect(questionCredit(q, ["A", "B", "C", "D"])).toBeCloseTo(2 / 3);
  });

  it("awards 0 for an unanswered multi-select question", () => {
    const q = makeQuestion({ type: "multi", correct: ["A", "B"] });
    expect(questionCredit(q, [])).toBe(0);
  });
});

describe("scaledScore", () => {
  it("returns 0 for an empty answerable set regardless of credit", () => {
    expect(scaledScore(5, 0)).toBe(0);
  });

  it("scales a perfect score to 1000", () => {
    expect(scaledScore(10, 10)).toBe(1000);
  });

  it("rounds to the nearest whole point on a non-terminating fraction", () => {
    // 1/3 * 1000 = 333.33... -> 333.
    expect(scaledScore(1, 3)).toBe(333);
  });
});

describe("byDomainBreakdown", () => {
  it("sums credit per domain and divides by that domain's own question count, not the answered count", () => {
    const questions: Question[] = [
      makeQuestion({ id: "d1-q1", domainId: "d1", correct: ["A"] }),
      makeQuestion({ id: "d1-q2", domainId: "d1", correct: ["A"] }),
      makeQuestion({ id: "d1-q3", domainId: "d1", correct: ["A"] }),
      makeQuestion({ id: "d2-q1", domainId: "d2", correct: ["A"] }),
    ];
    // Only 2 of d1's 3 questions are answered (the third has no entry in `answers` at all).
    const answers: Record<string, string[]> = {
      "d1-q1": ["A"],
      "d1-q2": ["B"],
      "d2-q1": ["A"],
    };

    const breakdown = byDomainBreakdown(questions, answers);

    expect(breakdown.d1!.answered).toBe(2);
    expect(breakdown.d1!.credit).toBe(1);
    // scaled divides by d1's full question count (3), not the 2 that were answered.
    expect(breakdown.d1!.scaled).toBe(scaledScore(1, 3));
    expect(breakdown.d2!.answered).toBe(1);
    expect(breakdown.d2!.credit).toBe(1);
    expect(breakdown.d2!.scaled).toBe(1000);
  });

  it("treats a question with no entry in `answers` as picked = [], contributing 0 credit", () => {
    const questions: Question[] = [makeQuestion({ id: "d1-q1", domainId: "d1" })];
    const breakdown = byDomainBreakdown(questions, {});
    expect(breakdown.d1!.answered).toBe(0);
    expect(breakdown.d1!.credit).toBe(0);
    expect(breakdown.d1!.scaled).toBe(0);
  });
});
