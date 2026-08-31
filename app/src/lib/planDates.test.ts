/**
 * Tests for planDates.ts's buildPlan() -- the crunch-mode compression fix for issue #76 (a real
 * exam date under a week away used to push early plan days into the past before the user ever saw
 * them, via remapPlan()'s pure linear date-shift). See that file's own module doc comment and
 * claude_plans/snowpro-crunch-mode-study-plan.md for the full design/derivation this pins down.
 *
 * Fixture PLAN mirrors the real authored content's shape exactly: 7 days, 6 pre-exam content days
 * (the crunch-mode merge table assumes exactly this many), with the same role tags
 * (pin-early/mock1/review/mock2) on the same relative days as SnowPro_Notes_and_Questions/
 * 00_Study_Plan.md, so these tests exercise the same bucketing the real content actually hits.
 */

import { describe, expect, it } from "vitest";
import { buildPlan, daysBetweenIso, remapPlan } from "./planDates";
import type { PlanDay } from "./content";

const PLAN: PlanDay[] = [
  {
    date: "2026-08-13",
    label: "Day 1",
    tasks: [
      { id: "d0-1", text: "Orientation", links: [], priority: "skippable" },
      { id: "d0-2", text: "Register for the exam", links: [], priority: "must", role: "pin-early" },
    ],
  },
  {
    date: "2026-08-14",
    label: "Day 2",
    tasks: [{ id: "d1-1", text: "Domain 1", links: [], priority: "must" }],
  },
  {
    date: "2026-08-15",
    label: "Day 3",
    tasks: [{ id: "d2-1", text: "Domain 4 + 2", links: [], priority: "must" }],
  },
  {
    date: "2026-08-16",
    label: "Day 4",
    tasks: [
      { id: "d3-1", text: "Domain 3", links: [], priority: "must" },
      { id: "d3-2", text: "Domain 5", links: [], priority: "skippable" },
      { id: "d3-3", text: "Mock Exam 1", links: [], priority: "must", role: "mock1" },
    ],
  },
  {
    date: "2026-08-17",
    label: "Day 5",
    tasks: [{ id: "d4-1", text: "Review Mock 1", links: [], priority: "must", role: "review" }],
  },
  {
    date: "2026-08-18",
    label: "Day 6",
    tasks: [{ id: "d5-1", text: "Mock Exam 2", links: [], priority: "must", role: "mock2" }],
  },
  {
    date: "2026-08-19",
    label: "Exam day",
    tasks: [{ id: "d6-1", text: "Light review only", links: [], priority: "must" }],
  },
];

/** `realDays` = days of runway including today itself (matches buildPlan's own internal
 *  realDaysUntilExam) -> the exam date that produces it, anchored at PLAN's own first day. */
function examDateForRealDays(realDays: number): string {
  const d = new Date(2026, 7, 13); // 2026-08-13, PLAN[0].date
  d.setDate(d.getDate() + (realDays - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TODAY = "2026-08-13";

function mockTaskTier(buckets: ReturnType<typeof buildPlan>["buckets"], role: "mock1" | "mock2" | "review" | "pin-early") {
  for (let i = 0; i < buckets.length; i++) {
    const t = buckets[i]!.tasks.find((t) => t.role === role);
    if (t) return { bucketIndex: i, tier: t.tier, reason: t.reason };
  }
  return undefined;
}

describe("buildPlan — linear mode (realDays >= plan.length)", () => {
  it("realDays === plan.length (7): mode is linear, output matches remapPlan() exactly", () => {
    const examDate = examDateForRealDays(7); // 2026-08-19, PLAN's own last day
    const result = buildPlan(PLAN, TODAY, examDate);
    expect(result.mode).toBe("linear");
    const expected = remapPlan(PLAN, examDate);
    expect(result.buckets.map((b) => b.displayDate)).toEqual(expected.map((d) => d.displayDate));
    expect(result.buckets.map((b) => b.sourceLabel)).toEqual(expected.map((d) => d.label));
    // "today" chip lands only on the bucket matching today, exactly like the pre-existing behavior.
    const todayIdx = result.buckets.findIndex((b) => b.displayDate === TODAY);
    expect(result.buckets[todayIdx]!.relativeLabel).toBe("today");
    result.buckets.forEach((b, i) => {
      if (i !== todayIdx) expect(b.relativeLabel).toBeUndefined();
    });
  });

  it("realDays > plan.length (20): still linear, plan-starts-in-N-days gap is untouched", () => {
    const examDate = examDateForRealDays(20);
    const result = buildPlan(PLAN, TODAY, examDate);
    expect(result.mode).toBe("linear");
    expect(result.buckets[0]!.displayDate > TODAY).toBe(true);
  });
});

describe("buildPlan — crunch mode boundary table", () => {
  it("realDays = 6: 6 buckets total, Mock 2 survives as must with no reason", () => {
    const result = buildPlan(PLAN, TODAY, examDateForRealDays(6));
    expect(result.mode).toBe("crunch");
    expect(result.buckets).toHaveLength(6);
    const mock2 = mockTaskTier(result.buckets, "mock2")!;
    expect(mock2.tier).toBe("must");
    expect(mock2.reason).toBeUndefined();
  });

  it("realDays = 5: 5 buckets total, Mock 2 still survives", () => {
    const result = buildPlan(PLAN, TODAY, examDateForRealDays(5));
    expect(result.mode).toBe("crunch");
    expect(result.buckets).toHaveLength(5);
    expect(mockTaskTier(result.buckets, "mock2")!.tier).toBe("must");
  });

  it("realDays = 4: the exact boundary — Mock 2's last surviving day, strict ordering holds", () => {
    const result = buildPlan(PLAN, TODAY, examDateForRealDays(4));
    expect(result.mode).toBe("crunch");
    expect(result.buckets).toHaveLength(4);
    const mock1 = mockTaskTier(result.buckets, "mock1")!;
    const review = mockTaskTier(result.buckets, "review")!;
    const mock2 = mockTaskTier(result.buckets, "mock2")!;
    expect(mock1.bucketIndex).toBeLessThan(review.bucketIndex);
    expect(review.bucketIndex).toBeLessThan(mock2.bucketIndex);
    expect(mock2.tier).toBe("must");
    // Exactly the four canonical crunch labels, in order, at this boundary.
    expect(result.buckets.map((b) => b.relativeLabel)).toEqual(["Tonight", "Tomorrow", "Exam eve", "Exam day"]);
  });

  it("realDays = 3: Mock 2 demotes to skippable with a reason; Mock 1 never demotes", () => {
    const result = buildPlan(PLAN, TODAY, examDateForRealDays(3));
    expect(result.mode).toBe("crunch");
    expect(result.buckets).toHaveLength(3);
    expect(mockTaskTier(result.buckets, "mock1")!.tier).toBe("must");
    const mock2 = mockTaskTier(result.buckets, "mock2")!;
    expect(mock2.tier).toBe("skippable");
    expect(mock2.reason).toBeTruthy();
  });

  it("realDays = 2: Mock 2 demoted, pin-early task still lands in bucket 0", () => {
    const result = buildPlan(PLAN, TODAY, examDateForRealDays(2));
    expect(result.mode).toBe("crunch");
    expect(result.buckets).toHaveLength(2);
    expect(mockTaskTier(result.buckets, "mock2")!.tier).toBe("skippable");
    expect(mockTaskTier(result.buckets, "pin-early")!.bucketIndex).toBe(0);
  });

  it("pin-early task's bucket index is always 0, at every crunch boundary (2-6)", () => {
    for (const realDays of [2, 3, 4, 5, 6]) {
      const result = buildPlan(PLAN, TODAY, examDateForRealDays(realDays));
      expect(mockTaskTier(result.buckets, "pin-early")!.bucketIndex).toBe(0);
    }
  });

  it("exam-day bucket only ever contains the authored exam day's own tasks as must, at every crunch boundary (2-6)", () => {
    for (const realDays of [2, 3, 4, 5, 6]) {
      const result = buildPlan(PLAN, TODAY, examDateForRealDays(realDays));
      const last = result.buckets[result.buckets.length - 1]!;
      const mustIds = last.tasks.filter((t) => t.tier === "must").map((t) => t.id);
      expect(mustIds).toEqual(["d6-1"]);
    }
  });
});

describe("buildPlan — exam today or already passed (realDays <= 1)", () => {
  it("exam is today: everything folds into one bucket, D1-D6 content becomes reference-only skippable, exam day's own task stays must", () => {
    const examDate = TODAY; // realDays = daysBetweenIso(today, today) + 1 = 1
    const result = buildPlan(PLAN, TODAY, examDate);
    expect(result.mode).toBe("crunch");
    expect(result.buckets).toHaveLength(1);
    const bucket = result.buckets[0]!;
    expect(bucket.displayDate).toBe(examDate);
    expect(bucket.relativeLabel).toBe("Exam day");
    const mustIds = bucket.tasks.filter((t) => t.tier === "must").map((t) => t.id);
    expect(mustIds).toEqual(["d6-1"]);
    const skippableIds = bucket.tasks.filter((t) => t.tier === "skippable").map((t) => t.id).sort();
    expect(skippableIds).toEqual(["d0-1", "d0-2", "d1-1", "d2-1", "d3-1", "d3-2", "d3-3", "d4-1", "d5-1"].sort());
    // Every folded (non-exam-day) skippable task carries a reason explaining the fold.
    const folded = bucket.tasks.filter((t) => t.id !== "d6-1");
    for (const t of folded) expect(t.reason).toBeTruthy();
  });

  it("exam already passed: doesn't throw, exam-day bucket's displayDate is the real past exam date", () => {
    const examDate = "2026-08-10"; // 3 days before TODAY (2026-08-13)
    expect(() => buildPlan(PLAN, TODAY, examDate)).not.toThrow();
    const result = buildPlan(PLAN, TODAY, examDate);
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]!.displayDate).toBe(examDate);
  });
});

describe("buildPlan — merge table length guard", () => {
  it("throws a clear error if the authored plan's day count doesn't match the hand-derived table's assumption", () => {
    const shortPlan = PLAN.slice(0, 4);
    expect(() => buildPlan(shortPlan, TODAY, examDateForRealDays(2))).toThrow(/6 pre-exam-day content days/);
  });
});

describe("daysBetweenIso sanity (used throughout the above)", () => {
  it("is inclusive-consistent with examDateForRealDays' construction", () => {
    expect(daysBetweenIso(TODAY, examDateForRealDays(7))).toBe(6);
  });
});
