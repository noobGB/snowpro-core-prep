/**
 * Study plan — spec §6.8. Day cards, today marked and scrolled to on open, past days collapsed
 * to a single completion row. Task checkboxes write to progress.plan.checked — the same array
 * the Dashboard's "Today" card reads, so checking a task in either place stays in sync.
 *
 * The pipeline deliberately emits each day's ORIGINAL source date, not a pre-baked offset (see
 * pipeline's studyPlan.ts docs) — the app is responsible for remapping every day by the delta
 * between the plan's own last day and the user's live exam date. That remap happens here.
 */

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { updateProgress, useProgress } from "../lib/progress";
import type { PlanDay } from "../lib/content";

const DEFAULT_EXAM_DATE = "2026-08-19";

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function daysBetweenIso(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}

interface RemappedDay extends PlanDay {
  displayDate: string;
}

function remapPlan(plan: PlanDay[], examDate: string): RemappedDay[] {
  if (plan.length === 0) return [];
  const anchor = plan[plan.length - 1]!.date;
  return plan.map((day) => ({ ...day, displayDate: addDays(examDate, daysBetweenIso(anchor, day.date)) }));
}

export function StudyPlan() {
  const { content, error } = useContent();
  const progress = useProgress();
  const todayRef = useRef<HTMLDivElement>(null);

  const examDate = progress.examDate ?? DEFAULT_EXAM_DATE;
  const today = isoDate(new Date());
  const days = content ? remapPlan(content.plan, examDate) : [];

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: "center" });
  }, [content, examDate]);

  const toggleTask = (taskId: string) =>
    updateProgress((p) => ({
      ...p,
      plan: {
        checked: p.plan.checked.includes(taskId) ? p.plan.checked.filter((id) => id !== taskId) : [...p.plan.checked, taskId],
      },
    }));

  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const totalTasks = content.plan.reduce((sum, d) => sum + d.tasks.length, 0);
  const doneTasks = content.plan.reduce((sum, d) => sum + d.tasks.filter((t) => progress.plan.checked.includes(t.id)).length, 0);
  const daysLeft = Math.max(0, daysBetweenIso(today, examDate));

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Study plan</h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {daysLeft} days left · {doneTasks}/{totalTasks} tasks
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {days.map((day) => {
          const isPast = day.displayDate < today;
          const isToday = day.displayDate === today;
          const doneCount = day.tasks.filter((t) => progress.plan.checked.includes(t.id)).length;
          const label = new Date(parseIso(day.displayDate)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

          if (isPast) {
            return (
              <div
                key={day.date}
                style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13, color: "var(--text-dim)" }}
              >
                <span>{label} — {day.label}</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{doneCount}/{day.tasks.length}</span>
              </div>
            );
          }

          return (
            <div
              key={day.date}
              ref={isToday ? todayRef : undefined}
              style={{ background: "var(--card)", border: `1px solid ${isToday ? "var(--accent)" : "var(--hairline)"}`, borderRadius: "var(--radius-card)", padding: 20 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>{label}</span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{day.label}</span>
                {isToday && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: ".08em", textTransform: "uppercase" }}>today</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {day.tasks.map((t) => {
                  const on = progress.plan.checked.includes(t.id);
                  return (
                    <div key={t.id} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "9px 4px" }}>
                      <button
                        type="button"
                        onClick={() => toggleTask(t.id)}
                        style={{
                          flex: "0 0 15px",
                          width: 15,
                          height: 15,
                          marginTop: 3,
                          borderRadius: 3,
                          border: `1px solid ${on ? "var(--accent)" : "var(--hairline-strong)"}`,
                          background: on ? "var(--accent)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          color: "var(--canvas)",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {on ? "✓" : ""}
                      </button>
                      <span style={{ fontSize: 14, lineHeight: 1.5, color: on ? "var(--text-dim)" : "var(--text-body)", textDecoration: on ? "line-through" : "none" }}>
                        {t.text}
                        {t.links.map((link) => (
                          <Link key={link} to={link} style={{ marginLeft: 8, fontSize: 12 }}>
                            →
                          </Link>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
