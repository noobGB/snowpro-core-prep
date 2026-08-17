/**
 * Shared date logic for the study plan (spec §6.8: "days shift automatically to land the day
 * before your exam date"). The pipeline deliberately emits each plan day's ORIGINAL source date
 * verbatim, not a pre-baked offset (see pipeline's studyPlan.ts docs) — every screen that shows
 * plan dates (Dashboard, Study plan, Settings) must remap by the delta between the plan's own
 * last day and the user's live exam date, and must fall back to a plan-length-derived default
 * (never a fixed calendar date) when no exam date has been set yet.
 */

import type { PlanDay } from "./content";

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

/** Remaps every plan day by the delta between the plan's own last day and the live exam date. */
export function remapPlan(plan: PlanDay[], examDate: string): RemappedPlanDay[] {
  if (plan.length === 0) return [];
  const anchor = plan[plan.length - 1]!.date;
  return plan.map((day) => ({ ...day, displayDate: addDays(examDate, daysBetweenIso(anchor, day.date)) }));
}
