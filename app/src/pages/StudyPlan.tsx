/**
 * Study plan — spec §6.8. Day cards, today marked and scrolled to on open, past days collapsed
 * to a single completion row. Task checkboxes write to progress.plan.checked — the same array
 * the Dashboard's "Today" card reads, so checking a task in either place stays in sync.
 *
 * The pipeline deliberately emits each day's ORIGINAL source date, not a pre-baked offset (see
 * pipeline's studyPlan.ts docs) — remapping against the live exam date (or a content-derived
 * default when none is set) lives in lib/planDates.ts, shared with Dashboard and Settings so the
 * three screens can't drift out of sync on what "today"/"exam date" mean.
 *
 * Issue #76: below a real-days-of-runway threshold, planDates.ts's buildPlan() compresses the
 * fixed 7-day authored plan into a discrete "crunch mode" instead of remapPlan()'s old pure linear
 * shift (which used to push early authored days into the past before the user ever saw them, on a
 * short exam-date runway). Crunch-mode buckets carry a relative label ("Tonight"/"Exam eve"/...)
 * instead of remapPlan()'s date-matched "today" chip, and each task carries a `tier` — "must"
 * always renders; "skippable" collapses behind a disclosure, never silently dropped.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { updateProgress, useProgress } from "../lib/progress";
import { buildPlan, daysBetweenIso, defaultExamDate, isoDate, parseIso, type BucketTask } from "../lib/planDates";

const chipStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

const disclosureButtonStyle: React.CSSProperties = {
  padding: "7px 12px",
  minHeight: 38,
  border: "1px solid var(--hairline)",
  background: "transparent",
  color: "var(--text-muted)",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  cursor: "pointer",
  alignSelf: "flex-start",
};

function TaskRow({ task, checked, onToggle }: { task: BucketTask; checked: boolean; onToggle: () => void }) {
  // A real <button role="checkbox"> sized to just the checkbox square, not a div wrapping the
  // whole row -- the task text (and its Link(s), when task.links is non-empty) render as a
  // sibling instead of a descendant. A <Link> nested inside a role="checkbox" element is a real
  // ambiguous-semantics bug (axe's nested-interactive rule), not just a style nit: a screen reader
  // can't cleanly separate "toggle this task" from "navigate to this note" when one is nested
  // inside the other, and it creates two overlapping tab stops for what should be two adjacent
  // ones. The text span keeps its own onClick=onToggle so "click anywhere on the row" behavior is
  // unchanged; native <button> also gives Enter/Space activation for free, so the manual
  // onKeyDown handler the old role="checkbox" div needed is gone too.
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "9px 4px" }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={task.text}
        onClick={onToggle}
        style={{
          flex: "0 0 15px",
          width: 15,
          height: 15,
          marginTop: 3,
          borderRadius: 3,
          border: `1px solid ${checked ? "var(--accent)" : "var(--hairline-strong)"}`,
          background: checked ? "var(--accent)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "var(--canvas)",
          padding: 0,
          cursor: "pointer",
        }}
      >
        {checked ? "✓" : ""}
      </button>
      <span onClick={onToggle} style={{ cursor: "pointer" }}>
        <span style={{ fontSize: 14, lineHeight: 1.5, color: checked ? "var(--text-dim)" : "var(--text-body)", textDecoration: checked ? "line-through" : "none" }}>
          {task.text}
          {task.links.map((link) => (
            <Link key={link} to={link} onClick={(e) => e.stopPropagation()} style={{ marginLeft: 8, fontSize: 12 }}>
              →
            </Link>
          ))}
        </span>
        {task.reason && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{task.reason}</div>}
      </span>
    </div>
  );
}

export function StudyPlan() {
  const { content, error } = useContent();
  const progress = useProgress();
  const todayRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const examDate = progress.examDate ?? (content ? defaultExamDate(content.plan) : isoDate(new Date()));
  const today = isoDate(new Date());
  const result = content ? buildPlan(content.plan, today, examDate) : { mode: "linear" as const, buckets: [] };
  const { mode, buckets } = result;

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: "center" });
  }, [content, examDate]);

  const toggleTask = (taskId: string) =>
    updateProgress((p) => ({
      ...p,
      plan: {
        ...p.plan,
        checked: p.plan.checked.includes(taskId) ? p.plan.checked.filter((id) => id !== taskId) : [...p.plan.checked, taskId],
      },
    }));

  const dismissCrunchExplainer = () =>
    updateProgress((p) => ({ ...p, plan: { ...p.plan, crunchExplainerSeen: true } }));

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

      {mode === "crunch" && !(progress.plan.crunchExplainerSeen ?? false) && (
        <div style={{ background: "var(--card)", border: "1px dashed var(--hairline)", borderRadius: "var(--radius-card)", padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: "var(--text-heading)", marginBottom: 8, fontWeight: 500 }}>
            Your exam is only {daysLeft} {daysLeft === 1 ? "day" : "days"} away — the plan's been condensed to fit.
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", margin: "0 0 12px" }}>
            Nothing's hidden. Must-do tasks are always shown; anything skippable is marked and
            collapsed, not removed — expand a card's disclosure to see it.
          </p>
          <button type="button" onClick={dismissCrunchExplainer} style={disclosureButtonStyle}>
            Got it
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {buckets.map((bucket, idx) => {
          const isPast = bucket.displayDate < today;
          const isToday = bucket.displayDate === today;
          const doneCount = bucket.tasks.filter((t) => progress.plan.checked.includes(t.id)).length;
          const dateLabel = parseIso(bucket.displayDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
          const key = `${bucket.displayDate}-${idx}`;

          if (isPast) {
            return (
              <div
                key={key}
                style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 13, color: "var(--text-dim)" }}
              >
                <span>{dateLabel} — {bucket.sourceLabel}</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{doneCount}/{bucket.tasks.length}</span>
              </div>
            );
          }

          const mustTasks = bucket.tasks.filter((t) => t.tier === "must");
          const skippableTasks = bucket.tasks.filter((t) => t.tier === "skippable");
          const isExpanded = expanded.has(key);

          return (
            <div
              key={key}
              ref={isToday ? todayRef : undefined}
              style={{ background: "var(--card)", border: `1px solid ${isToday ? "var(--accent)" : "var(--hairline)"}`, borderRadius: "var(--radius-card)", padding: 20 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>{dateLabel}</span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{bucket.sourceLabel}</span>
                {bucket.relativeLabel && <span style={chipStyle}>{bucket.relativeLabel}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {mustTasks.map((t) => (
                  <TaskRow key={t.id} task={t} checked={progress.plan.checked.includes(t.id)} onToggle={() => toggleTask(t.id)} />
                ))}
              </div>
              {skippableTasks.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((cur) => {
                        const next = new Set(cur);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    style={disclosureButtonStyle}
                  >
                    {isExpanded ? "Hide skippable items" : `Show ${skippableTasks.length} more ${skippableTasks.length === 1 ? "item" : "items"} you can skip if short on time`}
                  </button>
                  {isExpanded &&
                    skippableTasks.map((t) => (
                      <TaskRow key={t.id} task={t} checked={progress.plan.checked.includes(t.id)} onToggle={() => toggleTask(t.id)} />
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
