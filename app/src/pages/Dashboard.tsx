/**
 * Dashboard — the landing screen, per Dashboard.dc.html and spec §6.1. Live per the build order's
 * own note ("Dashboard goes live here", step 6): readiness, exam date, today's task checks, and
 * recent attempts all read/write through the progress store now. The documented empty state (no
 * attempts at all) still renders honestly when `progress.attempts` is actually empty, rather than
 * being a permanent placeholder.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { useProgress, updateProgress } from "../lib/progress";
import { overallReadiness } from "../lib/readiness";

const DEFAULT_EXAM_DATE = "2026-08-19";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(today: Date, exam: Date): number {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfExam = new Date(exam.getFullYear(), exam.getMonth(), exam.getDate());
  return Math.round((startOfExam.getTime() - startOfToday.getTime()) / 86400000);
}

function relativeDate(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--radius-card)",
  padding: 24,
};

const kicker: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: 12,
};

export function Dashboard() {
  const { content, error } = useContent();
  const progress = useProgress();

  const today = useMemo(() => new Date(), []);
  const examDate = progress.examDate ?? DEFAULT_EXAM_DATE;
  const [ey, em, ed] = examDate.split("-").map(Number);
  const exam = new Date(ey!, em! - 1, ed!);
  const days = daysBetween(today, exam);
  const daysWord = days === 0 ? "today" : days < 0 ? "exam passed" : days === 1 ? "day left" : "days left";

  const setExamDate = (value: string) => updateProgress((p) => ({ ...p, examDate: value }));
  const toggleTask = (taskId: string) =>
    updateProgress((p) => ({
      ...p,
      plan: {
        checked: p.plan.checked.includes(taskId) ? p.plan.checked.filter((id) => id !== taskId) : [...p.plan.checked, taskId],
      },
    }));

  const readiness = useMemo(
    () => (content ? overallReadiness(content, progress.attempts) : null),
    [content, progress.attempts],
  );

  if (error) {
    return (
      <div style={{ ...cardStyle, borderColor: "var(--status-incorrect)" }}>
        Couldn't load content.json — run the content pipeline first ({error.message}).
      </div>
    );
  }
  if (!content) return <div style={kicker}>Loading…</div>;

  const domain1 = content.domains.find((d) => d.number === 1);
  const set1 = content.sets.find((s) => s.id === "set-d1");
  const mockSet = content.sets.find((s) => s.kind === "mock");
  const planDayOne = content.plan[0];
  const todayPlan = content.plan.find((p) => p.date === isoDate(today));
  const doneCount = todayPlan?.tasks.filter((t) => progress.plan.checked.includes(t.id)).length ?? 0;

  const hasData = progress.attempts.length > 0;
  const resumeSet = progress.inProgress
    ? content.sets.find((s) => s.id === progress.inProgress!.setId)
    : undefined;

  const recentAttempts = [...progress.attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 4);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={kicker}>COF-C03</div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)", lineHeight: 1.1 }}>
            {!hasData && days <= 0 ? "Start here" : hasData ? "Three days out" : "Getting ready"}
          </h1>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          {today.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={kicker}>Exam</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 500, color: "var(--text-heading)", lineHeight: 1 }}>
              {days < 0 ? 0 : days}
            </span>
            <span style={{ fontSize: 15, color: "var(--text-muted)" }}>{daysWord}</span>
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              style={{
                background: "var(--raised)",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                color: "var(--text-body)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                padding: "7px 10px",
                minHeight: 36,
              }}
            />
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {exam.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
            </span>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            gridColumn: "span 2",
            border: "1px solid var(--accent)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 18,
            minHeight: 172,
          }}
        >
          {resumeSet ? (
            <>
              <div>
                <div style={{ ...kicker, color: "var(--accent)" }}>Resume</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-heading)", letterSpacing: "-0.012em", lineHeight: 1.25 }}>
                  {resumeSet.title}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>Left in progress</div>
              </div>
              <Link
                to={`/session/${resumeSet.id}`}
                style={{ display: "inline-flex", alignItems: "center", background: "var(--accent)", color: "var(--canvas)", borderRadius: 6, padding: "11px 18px", minHeight: 44, fontSize: 14, fontWeight: 500, width: "fit-content" }}
              >
                Continue
              </Link>
            </>
          ) : (
            <>
              <div>
                <div style={{ ...kicker, color: "var(--accent)" }}>{hasData ? "Keep going" : "Start"}</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-heading)", letterSpacing: "-0.012em", lineHeight: 1.25 }}>
                  {domain1 ? `Domain 1 — ${domain1.title}` : "Domain 1"}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>
                  {domain1 ? `${Math.round(domain1.weight * 100)}% of the exam` : ""}
                  {set1 ? ` · ${set1.questionIds.length} practice questions` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Link
                  to={set1 ? `/session/${set1.id}` : "/practice"}
                  style={{ display: "inline-flex", alignItems: "center", background: "var(--accent)", color: "var(--canvas)", borderRadius: 6, padding: "11px 18px", minHeight: 44, fontSize: 14, fontWeight: 500 }}
                >
                  {hasData ? "Practice Domain 1" : "Start Domain 1 practice"}
                </Link>
                <Link
                  to={mockSet ? `/session/${mockSet.id}` : "/mocks"}
                  style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: "var(--text-body)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "11px 16px", minHeight: 44, fontSize: 14 }}
                >
                  Start a mock exam
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {hasData && readiness ? (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              <div style={kicker}>Readiness</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 500, color: "var(--text-heading)", lineHeight: 1 }}>
                  {readiness.overall ?? "—"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-dim)" }}>/ 1000</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                Weighted by exam domain weight · pass line 750
                {readiness.measuredWeight < 0.999 && ` · ${Math.round(readiness.measuredWeight * 100)}% of the exam measured`}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {readiness.perDomain.map((d) => {
              const domain = content.domains.find((cd) => cd.id === d.domainId);
              return (
                <div key={d.domainId}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9, minWidth: 0 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>D{domain?.number}</span>
                      <span style={{ fontSize: 14, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{domain?.title}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", background: "rgba(255,255,255,.05)", borderRadius: 4, padding: "1px 6px" }}>
                        {domain ? Math.round(domain.weight * 100) : 0}%
                      </span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-heading)", whiteSpace: "nowrap" }}>
                      {d.scaled ?? "not measured"}
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 6, background: "var(--hairline)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: "var(--text-body)", borderRadius: 3, width: `${d.scaled ? d.scaled / 10 : 0}%` }} />
                  </div>
                  {d.lowSample && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>Low sample — one miss swings this a lot</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ ...cardStyle, border: "1px dashed var(--hairline)", marginBottom: 16 }}>
          <div style={kicker}>Nothing measured yet</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text-heading)", letterSpacing: "-0.012em", marginBottom: 8 }}>
            Start with day one of the plan
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-muted)", margin: "0 0 18px", maxWidth: "38em" }}>
            Readiness appears here once you have taken something. Until then the plan is the better
            guide{domain1 ? ` — Domain 1 is ${Math.round(domain1.weight * 100)}% of the exam and the natural place to start.` : "."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "38em" }}>
            {planDayOne?.tasks.map((t, i) => (
              <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: 14, color: "var(--text-body)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", paddingTop: 2 }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div style={kicker}>Today</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
              {todayPlan ? `${doneCount} / ${todayPlan.tasks.length}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {!todayPlan && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No plan day matches today's date.</div>}
            {todayPlan?.tasks.map((t) => {
              const on = progress.plan.checked.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  style={{ display: "flex", gap: 11, alignItems: "flex-start", textAlign: "left", width: "100%", minHeight: 44, padding: "11px 12px", border: "1px solid var(--hairline)", borderRadius: 6, background: "transparent", cursor: "pointer" }}
                >
                  <span
                    style={{
                      flex: "0 0 15px",
                      width: 15,
                      height: 15,
                      marginTop: 2,
                      borderRadius: 3,
                      border: `1px solid ${on ? "var(--accent)" : "var(--hairline-strong)"}`,
                      background: on ? "var(--accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "var(--canvas)",
                      lineHeight: 1,
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.45, color: on ? "var(--text-dim)" : "var(--text-body)", textDecoration: on ? "line-through" : "none" }}>
                    {t.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div style={kicker}>Recent attempts</div>
            <Link to="/analytics" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              All
            </Link>
          </div>
          {recentAttempts.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Nothing attempted yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentAttempts.map((a) => {
                const set = content.sets.find((s) => s.id === a.setId);
                return (
                  <Link
                    key={a.id}
                    to={`/results/${a.id}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--hairline-faint)" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{set?.title ?? a.setId}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
                        {a.kind} · {a.status} · {relativeDate(a.submittedAt)}
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-heading)", whiteSpace: "nowrap" }}>{a.scaled}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
