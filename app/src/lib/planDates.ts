/**
 * Shared date logic for the study plan (spec §6.8: "days shift automatically to land the day
 * before your exam date"). The pipeline deliberately emits each plan day's ORIGINAL source date
 * verbatim, not a pre-baked offset (see pipeline's studyPlan.ts docs) — every screen that shows
 * plan dates (Dashboard, Study plan, Settings) must remap by the delta between the plan's own
 * last day and the user's live exam date, and must fall back to a plan-length-derived default
 * (never a fixed calendar date) when no exam date has been set yet.
 */

import type { PlanDay, PlanTask } from "./content";

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daysBetweenIso(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}

/** No exam date set yet: default to today + the plan's own length, so the fallback is derived
 *  from the actual content instead of a fixed calendar date baked into the app. */
export function defaultExamDate(plan: PlanDay[]): string {
  const spanDays = plan.length > 0 ? plan.length - 1 : 0;
  return addDays(isoDate(new Date()), spanDays);
}

export interface RemappedPlanDay extends PlanDay {
  displayDate: string;
}

/** Remaps every plan day by the delta between the plan's own last day and the live exam date.
 *
 *  Kept exactly as-is, byte-for-byte, and never called with a different signature: `mcp-server`'s
 *  `getStudyPlan()` (session.ts) imports this function directly, cross-package, for the
 *  `get_study_plan` MCP tool. `buildPlan()` below is purely additive on top of this rather than a
 *  replacement, specifically so that consumer doesn't need to change (issue #76). */
export function remapPlan(plan: PlanDay[], examDate: string): RemappedPlanDay[] {
  if (plan.length === 0) return [];
  const anchor = plan[plan.length - 1]!.date;
  return plan.map((day) => ({ ...day, displayDate: addDays(examDate, daysBetweenIso(anchor, day.date)) }));
}

// --- Crunch mode (issue #76) --------------------------------------------------------------
//
// remapPlan() above is a pure linear date-shift: it slides all 7 authored days by one constant
// offset, so a real exam date under a week away pushes early days' displayDate into the past
// before the user ever sees them -- StudyPlan.tsx then renders them as if already missed. buildPlan()
// below is the fix: below a real-days threshold it compresses the authored week into however many
// real days actually remain ("crunch mode"), instead of just shifting it.
//
// The compression table (CONTENT_MERGE_GROUPS) is hand-derived for exactly the current plan shape
// -- 6 pre-exam-day content days feeding into fewer real-day buckets, always keeping the authored
// exam day (day 7) as its own separate, never-merged, never-compressed bucket. It intentionally
// does NOT generalize to an arbitrary plan length; if the authored plan's day count ever changes,
// buildPlan() throws rather than silently producing a wrong table (see the length guard below) --
// this is a personal single-user app with one authored plan, so a hand-checked table for its
// actual shape is more trustworthy than a generic algorithm nobody has verified against real
// content. See claude_plans/snowpro-crunch-mode-study-plan.md for how each row was derived.
//
// Three hard invariants, checked at runtime (not just baked into the table) so a future edit to
// the table or to which authored day carries which role tag can't silently violate them:
//   1. The exam-day bucket is always exactly the authored last day's own content (plus, only when
//      there's no earlier bucket to hold it at all, everything else folded in as skippable/
//      reference-only -- never as new must-do material).
//   2. Mock 2 stays "must" only if Mock 1's bucket index < the review bucket's index < Mock 2's
//      bucket index, strictly -- otherwise Mock 2 (never Mock 1) demotes to "skippable" with a
//      reason.
//   3. The {pin-early} (exam registration) task's bucket index is always 0.

export type PlanMode = "linear" | "crunch";

export interface BucketTask extends PlanTask {
  /** Effective tier after crunch-mode invariant overrides -- equal to `priority` except when an
   *  invariant demoted a task (Mock 2, when there's no real review gap) or folded it into
   *  reference-only overflow (realDays <= 1). Always equal to `priority` in linear mode. */
  tier: "must" | "skippable";
  /** Set only when `tier` or inclusion differs from the authored default -- same "always show the
   *  reason, not just the recommendation" precedent as readiness.ts's nextDomainReason. */
  reason?: string;
}

export interface PlanBucket {
  displayDate: string;
  /** Chip text. Linear mode: `"today"` on the bucket matching today, undefined elsewhere (exact
   *  reproduction of today's existing chip). Crunch mode: "Tonight"/"Tomorrow"/"Exam eve"/
   *  "Exam day", or a short weekday name for a bucket that lands between those edges. */
  relativeLabel?: string;
  /** Merged authored day.label(s), joined " + " when more than one authored day shares this
   *  bucket. */
  sourceLabel: string;
  tasks: BucketTask[];
}

export interface PlanResult {
  mode: PlanMode;
  buckets: PlanBucket[];
}

/** How many real calendar days of runway exist, counting today itself as day 1 -- so a plan whose
 *  exam date is today has 1 real day, not 0. This makes `realDays === plan.length` reproduce
 *  exactly `defaultExamDate()`'s own no-exam-date-set fallback (today + plan.length-1), which is
 *  what keeps that path in "linear" mode with zero behavior change. */
function realDaysUntilExam(today: string, examDate: string): number {
  return daysBetweenIso(today, examDate) + 1;
}

function relativeLabelFor(bucketIndex: number, totalBuckets: number, displayDate: string): string {
  if (bucketIndex === totalBuckets - 1) return "Exam day";
  if (totalBuckets >= 2 && bucketIndex === totalBuckets - 2) return "Exam eve";
  if (bucketIndex === 0) return "Tonight";
  if (bucketIndex === 1) return "Tomorrow";
  return parseIso(displayDate).toLocaleDateString("en-GB", { weekday: "short" });
}

function buildLinearBuckets(plan: PlanDay[], today: string, examDate: string): PlanBucket[] {
  return remapPlan(plan, examDate).map((day) => ({
    displayDate: day.displayDate,
    relativeLabel: day.displayDate === today ? "today" : undefined,
    sourceLabel: day.label,
    tasks: day.tasks.map((t) => ({ ...t, tier: t.priority })),
  }));
}

/** Which authored content-day indices (0-indexed, excluding the always-separate exam day) share a
 *  bucket, keyed by real days of runway. See the module doc comment above for how each row was
 *  derived and why this doesn't generalize past the plan's current 7-day shape. */
const CONTENT_MERGE_GROUPS: Record<number, number[][]> = {
  2: [[0, 1, 2, 3, 4, 5]],
  3: [[0, 1, 2, 3], [4, 5]],
  4: [[0, 1, 2, 3], [4], [5]],
  5: [[0, 1], [2, 3], [4], [5]],
  6: [[0, 1], [2], [3], [4], [5]],
};

interface WorkingBucket {
  sourceLabel: string;
  tasks: BucketTask[];
}

/** Invariant 2: Mock 2 only stays "must" if Mock 1's bucket strictly precedes the review bucket,
 *  which strictly precedes Mock 2's bucket. Otherwise Mock 2 (never Mock 1) demotes. */
function applyMockGapInvariant(buckets: WorkingBucket[]): void {
  const bucketOf = (role: PlanTask["role"]) => buckets.findIndex((b) => b.tasks.some((t) => t.role === role));
  const mock1At = bucketOf("mock1");
  const reviewAt = bucketOf("review");
  const mock2At = bucketOf("mock2");
  if (mock2At === -1) return; // already folded into crunch overflow (realDays <= 1) -- nothing to demote here

  const hasRealGap = mock1At !== -1 && reviewAt !== -1 && mock1At < reviewAt && reviewAt < mock2At;
  if (hasRealGap) return;

  for (const t of buckets[mock2At]!.tasks) {
    if (t.role === "mock2") {
      t.tier = "skippable";
      t.reason = "No real review gap after Mock 1 before the exam — attempt only if you have spare time.";
    }
  }
}

/** Invariant 3: the pin-early (exam registration) task's bucket index is always 0. Thrown, not
 *  logged, since this is a data-integrity bug in the merge table, not a soft warning. */
function assertPinnedEarly(buckets: WorkingBucket[]): void {
  const at = buckets.findIndex((b) => b.tasks.some((t) => t.role === "pin-early"));
  if (at > 0) {
    throw new Error("planDates.buildPlan: {pin-early} task landed outside bucket 0 — merge table regression");
  }
}

/** Invariant 1: every must-tier task in the exam-day bucket has to actually be sourced from the
 *  plan's own authored last day — crunch-mode overflow tasks (realDays <= 1) may share this
 *  bucket, but only ever as tier:"skippable" reference material, never as must-do. */
function assertExamDayNeverGetsNewMustDoMaterial(examDayBucket: WorkingBucket, examDayAuthored: PlanDay): void {
  const examDayIds = new Set(examDayAuthored.tasks.map((t) => t.id));
  for (const t of examDayBucket.tasks) {
    if (t.tier === "must" && !examDayIds.has(t.id)) {
      throw new Error(
        "planDates.buildPlan: a non-exam-day task reached the exam-day bucket as must-do — merge table regression",
      );
    }
  }
}

function buildCrunchBuckets(plan: PlanDay[], today: string, examDate: string): PlanBucket[] {
  const examDayAuthored = plan[plan.length - 1]!;
  const contentDays = plan.slice(0, plan.length - 1);
  if (contentDays.length !== 6) {
    throw new Error(
      `planDates.buildPlan: crunch-mode merge table assumes exactly 6 pre-exam-day content days, got ${contentDays.length} — the authored plan's shape changed and the table needs re-deriving (see claude_plans/snowpro-crunch-mode-study-plan.md)`,
    );
  }

  const realDays = realDaysUntilExam(today, examDate);
  const effectiveRealDays = Math.max(1, Math.min(realDays, contentDays.length));

  const groups = effectiveRealDays <= 1 ? [] : CONTENT_MERGE_GROUPS[effectiveRealDays]!;
  const workingBuckets: WorkingBucket[] = groups.map((idxGroup) => ({
    sourceLabel: idxGroup.map((i) => contentDays[i]!.label).join(" + "),
    tasks: idxGroup.flatMap((i) => contentDays[i]!.tasks.map((t) => ({ ...t, tier: t.priority }))),
  }));

  // realDays <= 1 (exam today, tomorrow with no room, or already passed): nothing earlier to hold
  // D1-D6's content, so it folds into the exam-day bucket itself as reference-only -- explicitly
  // demoted, never presented as must-do new material (invariant 1).
  const overflowTasks: BucketTask[] =
    effectiveRealDays <= 1
      ? contentDays.flatMap((d) =>
          d.tasks.map((t) => ({
            ...t,
            tier: "skippable" as const,
            reason: "No time left before the exam — reference only.",
          })),
        )
      : [];

  applyMockGapInvariant(workingBuckets);
  assertPinnedEarly(workingBuckets);

  const examDayBucket: WorkingBucket = {
    sourceLabel: examDayAuthored.label,
    tasks: [...overflowTasks, ...examDayAuthored.tasks.map((t) => ({ ...t, tier: t.priority }))],
  };
  assertExamDayNeverGetsNewMustDoMaterial(examDayBucket, examDayAuthored);

  const all = [...workingBuckets, examDayBucket];
  const total = all.length;
  // Content buckets fill the real days immediately preceding the exam, counting backward from
  // examDate -- this lands the last bucket exactly on examDate (even when examDate is today or
  // already past) without needing separate clamped/unclamped date math for that case.
  return all.map((b, i) => {
    const displayDate = addDays(examDate, i - (total - 1));
    return {
      displayDate,
      relativeLabel: relativeLabelFor(i, total, displayDate),
      sourceLabel: b.sourceLabel,
      tasks: b.tasks,
    };
  });
}

/** The single entry point Dashboard/StudyPlan should use going forward. Below `plan.length` real
 *  days of runway, compresses into crunch mode (see module doc comment above); at or above it,
 *  behavior is byte-identical to calling `remapPlan()` directly, including the existing "plan
 *  starts in N days" long-runway gap case, which this deliberately leaves untouched (issue #76's
 *  stated scope -- see claude_plans/snowpro-crunch-mode-study-plan.md's Context section for why). */
export function buildPlan(plan: PlanDay[], today: string, examDate: string): PlanResult {
  if (plan.length === 0) return { mode: "linear", buckets: [] };
  const mode: PlanMode = realDaysUntilExam(today, examDate) >= plan.length ? "linear" : "crunch";
  return {
    mode,
    buckets: mode === "linear" ? buildLinearBuckets(plan, today, examDate) : buildCrunchBuckets(plan, today, examDate),
  };
}
