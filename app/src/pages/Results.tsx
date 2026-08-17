/**
 * Results — spec §6.5. Headline scaled score against the 750 pass line, a per-domain breakdown,
 * then the review: incorrect, then partial credit, then unanswered, then a single collapsed row
 * for everything correct. Each reviewed question shows every option with the picked/correct ones
 * marked and the explanation verbatim.
 *
 * "Link to the exact note section" from the spec isn't available at question granularity — the
 * content pipeline deliberately leaves `question.section` undefined (no source data maps a
 * question to a domain-note subsection; see pipeline's own docs). This links to the domain notes
 * page instead, the best granularity the data actually supports.
 */

import { Link, useParams } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { useProgress, type Attempt } from "../lib/progress";
import type { Question } from "../lib/content";

const PASS_LINE = 750;

type ReviewBucket = "incorrect" | "partial" | "unanswered" | "correct";

function bucketFor(credit: number, picked: string[]): ReviewBucket {
  if (picked.length === 0) return "unanswered";
  if (credit >= 1) return "correct";
  if (credit > 0) return "partial";
  return "incorrect";
}

const bucketColor: Record<ReviewBucket, string> = {
  incorrect: "var(--status-incorrect)",
  partial: "var(--status-warning)",
  unanswered: "var(--hairline-strong)",
  correct: "var(--status-correct)",
};

const bucketLabel: Record<ReviewBucket, string> = {
  incorrect: "Missed",
  partial: "Partial credit",
  unanswered: "Unanswered",
  correct: "Correct",
};

export function Results() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const progress = useProgress();
  const { content } = useContent();

  const attempt = progress.attempts.find((a: Attempt) => a.id === attemptId);
  if (!attempt) {
    return <div style={{ color: "var(--text-dim)" }}>No attempt found with id {attemptId}.</div>;
  }
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const set = content.sets.find((s) => s.id === attempt.setId);
  const questionsById = new Map(content.questions.map((q) => [q.id, q]));
  const orderedQuestions = set ? set.questionIds.map((id) => questionsById.get(id)).filter((q): q is Question => !!q) : [];

  const passed = attempt.scaled >= PASS_LINE;
  const groups: Record<ReviewBucket, Question[]> = { incorrect: [], partial: [], unanswered: [], correct: [] };
  for (const q of orderedQuestions) {
    const a = attempt.answers[q.id];
    groups[bucketFor(a?.credit ?? 0, a?.picked ?? [])].push(q);
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
        {set?.title ?? attempt.setId} · {attempt.status}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 56, fontWeight: 500, color: "var(--text-heading)", lineHeight: 1 }}>
          {attempt.scaled}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--text-dim)" }}>/ 1000</span>
        <span style={{ fontSize: 14, color: passed ? "var(--status-correct)" : "var(--status-incorrect)", fontWeight: 500 }}>
          {passed ? "Pass" : "Below pass line"}
        </span>
      </div>
      <div style={{ position: "relative", height: 6, background: "var(--hairline)", borderRadius: 3, marginBottom: 8 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, attempt.scaled / 10)}%`, background: "var(--text-body)", borderRadius: 3 }} />
        <div style={{ position: "absolute", left: `${PASS_LINE / 10}%`, top: -3, width: 1, height: 12, background: "var(--accent)" }} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 24 }}>
        Pass line 750 · {orderedQuestions.length} questions · {Math.round(attempt.durationSec / 60)} min
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 20, marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 14 }}>
          By domain
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(attempt.byDomain).map(([domainId, d]) => (
            <div key={domainId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-body)" }}>
              <span>{content.domains.find((dm) => dm.id === domainId)?.title ?? domainId}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-heading)" }}>
                {d.scaled} <span style={{ color: "var(--text-dim)" }}>({d.answered} answered)</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {(["incorrect", "partial", "unanswered"] as const).map((bucket) =>
        groups[bucket].length > 0 ? (
          <ReviewSection key={bucket} bucket={bucket} questions={groups[bucket]} attempt={attempt} />
        ) : null,
      )}

      {groups.correct.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary
            style={{
              cursor: "pointer",
              padding: "10px 12px",
              border: "1px solid var(--hairline)",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--text-dim)",
              listStyle: "none",
            }}
          >
            ▸ {groups.correct.length} correct — collapsed
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {groups.correct.map((q) => (
              <ReviewCard key={q.id} question={q} attempt={attempt} bucket="correct" />
            ))}
          </div>
        </details>
      )}

      <div style={{ marginTop: 24 }}>
        <Link to="/" style={{ fontSize: 14 }}>
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function ReviewSection({ bucket, questions, attempt }: { bucket: ReviewBucket; questions: Question[]; attempt: Attempt }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: bucketColor[bucket], marginBottom: 12 }}>
        {bucketLabel[bucket]} · {questions.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {questions.map((q) => (
          <ReviewCard key={q.id} question={q} attempt={attempt} bucket={bucket} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ question, attempt, bucket }: { question: Question; attempt: Attempt; bucket: ReviewBucket }) {
  const answer = attempt.answers[question.id];
  const picked = answer?.picked ?? [];

  return (
    <div style={{ background: "var(--card)", border: `1px solid ${bucket === "incorrect" ? "var(--status-incorrect)" : "var(--hairline)"}`, borderRadius: "var(--radius-card)", padding: 20 }}>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)", marginBottom: 14 }}>{question.stem}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {question.options.map((opt) => {
          const isCorrect = question.correct.includes(opt.key);
          const isPicked = picked.includes(opt.key);
          let border = "var(--hairline)";
          let marker = "";
          if (isCorrect && isPicked) {
            border = "var(--status-correct)";
            marker = "✓";
          } else if (isCorrect && !isPicked) {
            border = "var(--status-correct)";
            marker = "correct";
          } else if (!isCorrect && isPicked) {
            border = "var(--status-incorrect)";
            marker = "✕";
          }
          return (
            <div
              key={opt.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "9px 12px",
                border: `1px solid ${border}`,
                borderRadius: 6,
                fontSize: 13,
                color: "var(--text-body)",
              }}
            >
              <span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginRight: 8 }}>{opt.key}</span>
                {opt.text}
              </span>
              {marker && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: isCorrect ? "var(--status-correct)" : "var(--status-incorrect)",
                    flexShrink: 0,
                  }}
                >
                  {marker}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", margin: "0 0 10px" }}>{question.explanation}</p>
      <Link to={`/notes/${question.domainId}`} style={{ fontSize: 12 }}>
        Read the note →
      </Link>
    </div>
  );
}
