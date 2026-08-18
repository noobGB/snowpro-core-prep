/**
 * Question runner — shared by practice and mock (spec §6.4). One question per screen with
 * Prev/Next and a jump palette (Pearson-VUE-style: answered/flagged/current/unanswered), not a
 * long scroll — pacing is itself part of what SnowPro Core tests, so the runner shouldn't train
 * scanning/scrolling behavior instead of one-decision-at-a-time. Answers withheld until submit,
 * a single sticky bar carrying progress/timer/submit. "Flag for review" is session-only UI state
 * (not persisted to progress) — a scratch aid, not part of the scored record.
 *
 * A mock set gets a pre-start confirmation gate (states the rules before the clock begins) —
 * not the full Mock Exams list screen (that's build-order step 7), just the runner's own entry
 * gate, since starting the clock is squarely "strict timer" behavior. Mock timing is strict: no
 * pause, elapsed time is computed from the stored start timestamp (not a ticking "remaining"
 * counter), so closing the tab doesn't stop the clock. Leaving a practice session mid-way scores
 * what was answered and logs status "partial"; leaving a mock just leaves it resumable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useContent } from "../lib/useContent";
import type { Question, QuestionSet } from "../lib/content";
import { byDomainBreakdown, questionCredit, scaledScore } from "../lib/scoring";
import { getProgress, updateProgress, type Attempt, type AttemptStatus } from "../lib/progress";
import { renderInline } from "../lib/inlineMarkdown";

/** Practice.tsx's "Retry these" action navigates here with the missed questions' ids in router
 *  state, rather than one of content.json's static sets — reuses every bit of the runner's
 *  practice-mode logic (untimed, immediate start, partial-on-leave) via a synthetic set object. */
const RETRY_SET_ID = "retry";

type AnswersMap = Record<string, string[]>;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Runner() {
  const { setId } = useParams<{ setId: string }>();
  const { content, error } = useContent();
  const navigate = useNavigate();
  const location = useLocation();

  const retryQuestionIds = setId === RETRY_SET_ID ? (location.state as { questionIds?: string[] } | null)?.questionIds : undefined;
  const retrySet: QuestionSet | undefined =
    retryQuestionIds && retryQuestionIds.length > 0
      ? { id: RETRY_SET_ID, kind: "domain", title: "Retry missed questions", questionIds: retryQuestionIds, timed: false }
      : undefined;
  const set = retrySet ?? content?.sets.find((s) => s.id === setId);
  const questions = useMemo<Question[]>(() => {
    if (!content || !set) return [];
    const byId = new Map(content.questions.map((q) => [q.id, q]));
    return set.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q);
  }, [content, set]);

  const [answers, setAnswersState] = useState<AnswersMap>({});
  const answersRef = useRef<AnswersMap>({});
  const sessionRef = useRef<{ id: string; startedAt: string } | null>(null);
  const submittedRef = useRef(false);
  const [, forceTick] = useState(0);
  const [mockStarted, setMockStarted] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const setAnswers = useCallback((updater: (prev: AnswersMap) => AnswersMap) => {
    setAnswersState((prev) => {
      const next = updater(prev);
      answersRef.current = next;
      return next;
    });
  }, []);

  const elapsedSec = useCallback(() => {
    if (!sessionRef.current) return 0;
    return Math.round((Date.now() - new Date(sessionRef.current.startedAt).getTime()) / 1000);
  }, []);

  const finalize = useCallback(
    (status: AttemptStatus) => {
      if (!set || !sessionRef.current || !content || submittedRef.current) return;
      submittedRef.current = true;
      const { id, startedAt } = sessionRef.current;
      const currentAnswers = answersRef.current;

      const answerRecords: Attempt["answers"] = {};
      let totalCredit = 0;
      for (const q of questions) {
        const picked = currentAnswers[q.id] ?? [];
        const credit = questionCredit(q, picked);
        totalCredit += credit;
        answerRecords[q.id] = { picked, correct: credit === 1, credit, timeSec: elapsedSec() };
      }

      const attempt: Attempt = {
        id,
        setId: set.id,
        kind: set.kind,
        bankVersion: content.bankVersion,
        startedAt,
        submittedAt: new Date().toISOString(),
        status,
        durationSec: elapsedSec(),
        answers: answerRecords,
        scaled: scaledScore(totalCredit, questions.length),
        rawPct: questions.length > 0 ? totalCredit / questions.length : 0,
        byDomain: byDomainBreakdown(questions, currentAnswers),
      };

      updateProgress((p) => ({ ...p, attempts: [...p.attempts, attempt], inProgress: null }));
      if (status !== "partial") navigate(`/results/${id}`);
    },
    [set, content, questions, elapsedSec, navigate],
  );

  // Init: resume an in-progress attempt for this set, or start a fresh one (practice starts
  // immediately; mock waits for the confirmation gate below).
  const initedForSetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!set || initedForSetRef.current === set.id) return;
    initedForSetRef.current = set.id;
    submittedRef.current = false;

    const existing = getProgress().inProgress;
    if (existing && existing.setId === set.id) {
      sessionRef.current = { id: existing.id, startedAt: existing.startedAt };
      const seeded: AnswersMap = {};
      for (const [qid, a] of Object.entries(existing.answers)) seeded[qid] = a.picked;
      answersRef.current = seeded;
      setAnswersState(seeded);
      // Resume where you left off — jump to the first still-unanswered question rather than
      // dropping back at question 1, since the point of resuming is to keep going, not restart.
      const firstUnanswered = questions.findIndex((q) => (seeded[q.id]?.length ?? 0) === 0);
      setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
      if (set.kind === "mock") setMockStarted(true);
      return;
    }

    setCurrentIndex(0);
    setFlagged(new Set());
    if (set.kind !== "mock") {
      const id = newId();
      const startedAt = new Date().toISOString();
      sessionRef.current = { id, startedAt };
      updateProgress((p) => ({
        ...p,
        inProgress: { id, setId: set.id, kind: set.kind, bankVersion: content?.bankVersion ?? "", startedAt, answers: {} },
      }));
    }
    // mock: sessionRef stays null until the confirmation gate starts it
  }, [set, content?.bankVersion]);

  // Leaving a practice session mid-way scores what was answered as "partial." Mocks are left
  // resumable instead (closing the tab must not stop the clock).
  useEffect(() => {
    return () => {
      if (set?.kind === "domain" && sessionRef.current && !submittedRef.current) {
        finalize("partial");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  // Mock timer: ticks once a second purely to re-render the countdown; the actual remaining
  // time is always recomputed from the stored start timestamp, never a decrementing counter.
  useEffect(() => {
    if (set?.kind !== "mock" || !mockStarted) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [set?.kind, mockStarted]);

  const durationSec = (set?.durationMin ?? 115) * 60;
  const remainingSec = sessionRef.current ? durationSec - elapsedSec() : durationSec;

  useEffect(() => {
    if (set?.kind === "mock" && mockStarted && sessionRef.current && remainingSec <= 0 && !submittedRef.current) {
      finalize("expired");
    }
  }, [set?.kind, mockStarted, remainingSec, finalize]);

  const startMock = () => {
    if (!set || !content) return;
    const id = newId();
    const startedAt = new Date().toISOString();
    sessionRef.current = { id, startedAt };
    updateProgress((p) => ({
      ...p,
      inProgress: { id, setId: set.id, kind: "mock", bankVersion: content.bankVersion, startedAt, answers: {} },
    }));
    setMockStarted(true);
  };

  const toggleOption = (question: Question, key: string) => {
    // `next` is computed from answersRef (always current — setAnswers keeps it in sync
    // synchronously) rather than inside setAnswers' own updater, so updateProgress below runs
    // as a plain sibling statement in this event handler, not nested inside a setState updater
    // — calling it from there trips "Cannot update a component while rendering a different
    // component" once a second progress subscriber (CommandPalette) exists alongside Runner.
    const current = answersRef.current[question.id] ?? [];
    const next =
      question.type === "single"
        ? current[0] === key
          ? []
          : [key]
        : current.includes(key)
          ? current.filter((k) => k !== key)
          : [...current, key];

    setAnswers((prev) => ({ ...prev, [question.id]: next }));

    updateProgress((p) =>
      p.inProgress
        ? { ...p, inProgress: { ...p.inProgress, answers: { ...p.inProgress.answers, [question.id]: { picked: next, timeSec: elapsedSec() } } } }
        : p,
    );
  };

  // Arrow-key navigation, matching one-decision-at-a-time exam software conventions. Skipped
  // while the mock's pre-start gate is showing (currentIndex isn't meaningful yet), and skipped
  // when focus is in a text/date input (the ⌘K palette or Settings' exam-date field are reachable
  // from every route, this one included — their own arrow-key handling must win, not this).
  useEffect(() => {
    if (set?.kind === "mock" && !mockStarted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
      else if (e.key === "ArrowLeft") setCurrentIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set?.kind, mockStarted, questions.length]);

  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;
  if (!set) {
    return (
      <div style={{ color: "var(--text-dim)" }}>
        {setId === RETRY_SET_ID ? "Nothing to retry — start from the Practice page's missed filter." : `No such set: ${setId}`}
      </div>
    );
  }

  if (set.kind === "mock" && !mockStarted) {
    return (
      <div style={{ maxWidth: 640, margin: "10vh auto 0" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
            {set.title}
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 500, color: "var(--text-heading)" }}>
            {set.durationMin ?? 115} minutes, no pause
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-muted)", margin: "0 0 24px" }}>
            The timer starts the moment you click start and cannot be paused. Closing the tab does
            not stop the clock — elapsed time is computed from your start time when you return.
            It auto-submits at zero.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={startMock}
              style={{ background: "var(--accent)", color: "var(--canvas)", border: "none", borderRadius: 6, padding: "11px 18px", minHeight: 44, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              Start {set.title}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{ background: "transparent", color: "var(--text-body)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "11px 16px", minHeight: 44, fontSize: 14, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const answeredCount = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
  const unansweredCount = questions.length - answeredCount;
  const pct = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const showWarning = set.kind === "mock" && remainingSec <= 600 && remainingSec > 0;
  const currentQuestion = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

  const doSubmit = () => {
    if (unansweredCount > 0 && !confirmingSubmit) {
      setConfirmingSubmit(true);
      return;
    }
    finalize("complete");
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--canvas)",
          borderBottom: "1px solid var(--hairline)",
          padding: "12px 0",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Q{currentIndex + 1}/{questions.length} · {answeredCount} answered
        </div>
        <div style={{ flex: 1, height: 4, background: "var(--hairline)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "var(--text-body)", width: `${pct}%`, borderRadius: 2 }} />
        </div>
        {set.kind === "mock" && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              color: remainingSec <= 600 ? "var(--status-warning)" : "var(--text-body)",
              whiteSpace: "nowrap",
            }}
          >
            {formatClock(remainingSec)}
          </div>
        )}
        <button
          type="button"
          onClick={doSubmit}
          style={{ background: "var(--accent)", color: "var(--canvas)", border: "none", borderRadius: 6, padding: "9px 16px", minHeight: 40, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Submit
        </button>
      </div>

      {showWarning && (
        <div style={{ background: "rgba(201,187,74,.08)", border: "1px solid var(--status-warning)", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--status-warning)" }}>
          Under 10 minutes left — the exam auto-submits at zero.
        </div>
      )}

      {confirmingSubmit && (
        <div style={{ background: "var(--raised)", border: "1px solid var(--hairline-strong)", borderRadius: 6, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--text-body)" }}>
            {unansweredCount} question{unansweredCount === 1 ? "" : "s"} unanswered — they'll score zero. Submit anyway?
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => finalize("complete")}
              style={{ background: "var(--accent)", color: "var(--canvas)", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              Submit anyway
            </button>
            <button
              type="button"
              onClick={() => setConfirmingSubmit(false)}
              style={{ background: "transparent", color: "var(--text-body)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
            >
              Keep going
            </button>
          </div>
        </div>
      )}

      {currentQuestion && (
        <QuestionCard
          index={currentIndex}
          question={currentQuestion}
          picked={answers[currentQuestion.id] ?? []}
          onToggle={(key) => toggleOption(currentQuestion, key)}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, maxWidth: 760 }}>
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
          disabled={isFirst}
          style={{
            background: "transparent",
            color: isFirst ? "var(--text-dim)" : "var(--text-body)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "9px 16px",
            minHeight: 40,
            fontSize: 13,
            cursor: isFirst ? "not-allowed" : "pointer",
          }}
        >
          ← Previous
        </button>
        {currentQuestion && (
          <button
            type="button"
            onClick={() => toggleFlag(currentQuestion.id)}
            style={{
              background: flagged.has(currentQuestion.id) ? "rgba(201,187,74,.1)" : "transparent",
              color: flagged.has(currentQuestion.id) ? "var(--status-warning)" : "var(--text-muted)",
              border: `1px solid ${flagged.has(currentQuestion.id) ? "var(--status-warning)" : "var(--hairline)"}`,
              borderRadius: 6,
              padding: "9px 16px",
              minHeight: 40,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {flagged.has(currentQuestion.id) ? "Flagged for review" : "Flag for review"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))}
          disabled={isLast}
          style={{
            background: "transparent",
            color: isLast ? "var(--text-dim)" : "var(--text-body)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "9px 16px",
            minHeight: 40,
            fontSize: 13,
            cursor: isLast ? "not-allowed" : "pointer",
          }}
        >
          Next →
        </button>
      </div>

      <div style={{ marginTop: 28, maxWidth: 760 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
            Jump to
          </div>
          <Legend swatch="var(--raised)" border="var(--hairline-strong)" label="answered" />
          <Legend swatch="transparent" border="var(--status-warning)" label="flagged" />
          <Legend swatch="transparent" border="var(--accent)" label="current" />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {questions.map((q, i) => {
            const isAnswered = (answers[q.id]?.length ?? 0) > 0;
            const isFlagged = flagged.has(q.id);
            const isCurrent = i === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", unanswered"}${isFlagged ? ", flagged" : ""}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor: "pointer",
                  border: `1px solid ${isFlagged ? "var(--status-warning)" : "var(--hairline-strong)"}`,
                  outline: isCurrent ? "2px solid var(--accent)" : "none",
                  outlineOffset: 1,
                  background: isAnswered ? "var(--raised)" : "transparent",
                  color: isAnswered ? "var(--text-heading)" : "var(--text-dim)",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, border, label }: { swatch: string; border: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-dim)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: swatch, border: `1px solid ${border}` }} />
      {label}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  picked,
  onToggle,
}: {
  index: number;
  question: Question;
  picked: string[];
  onToggle: (key: string) => void;
}) {
  const isMulti = question.type === "multi";
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Roving tabindex for the single-select radiogroup (ARIA APG pattern): only one option is ever
  // a Tab stop at a time — the currently-selected one, or the first option before anything's
  // picked. isMulti's checkboxes are deliberately left out of this: each one stays independently
  // Tab-able (its native default), which is already correct ARIA behavior for a checkbox group.
  const [rovingKey, setRovingKey] = useState<string>(() => picked[0] ?? question.options[0]?.key ?? "");

  // A new question swaps `question`/`picked` together in the same render (Runner reuses this
  // component instance rather than remounting it per-question), so re-seed roving focus whenever
  // the question identity changes — otherwise the previous question's roving key would linger.
  useEffect(() => {
    setRovingKey(picked[0] ?? question.options[0]?.key ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const moveRovingFocus = (key: string) => {
    setRovingKey(key);
    onToggle(key);
    optionRefs.current[key]?.focus();
  };

  const onGroupKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = question.options.map((o) => o.key);
    if (keys.length === 0) return;
    const currentPos = Math.max(0, keys.indexOf(rovingKey));
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      moveRovingFocus(keys[(currentPos + 1) % keys.length]!);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      moveRovingFocus(keys[(currentPos - 1 + keys.length) % keys.length]!);
    }
  };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Q{index + 1}</span>
        {isMulti && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", background: "rgba(255,255,255,.05)", borderRadius: 4, padding: "1px 6px" }}>
            select {question.correct.length}
          </span>
        )}
      </div>
      <div id={`stem-${question.id}`} className="inline-md" style={{ fontSize: 16, lineHeight: 1.6, color: "var(--text-body)", marginBottom: 16 }}>
        {renderInline(question.stem)}
      </div>
      <div
        role={isMulti ? "group" : "radiogroup"}
        aria-labelledby={`stem-${question.id}`}
        onKeyDown={isMulti ? undefined : onGroupKeyDown}
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        {question.options.map((opt) => {
          const selected = picked.includes(opt.key);
          return (
            <button
              key={opt.key}
              ref={(el) => {
                optionRefs.current[opt.key] = el;
              }}
              type="button"
              role={isMulti ? "checkbox" : "radio"}
              aria-checked={selected}
              tabIndex={isMulti ? undefined : opt.key === rovingKey ? 0 : -1}
              onClick={() => {
                if (!isMulti) setRovingKey(opt.key);
                onToggle(opt.key);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 11,
                textAlign: "left",
                width: "100%",
                minHeight: 44,
                padding: "11px 12px",
                border: `1px solid ${selected ? "var(--accent)" : "var(--hairline)"}`,
                borderRadius: 6,
                background: selected ? "var(--raised)" : "transparent",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  flex: "0 0 15px",
                  width: 15,
                  height: 15,
                  marginTop: 2,
                  borderRadius: isMulti ? 3 : "50%",
                  border: `1px solid ${selected ? "var(--accent)" : "var(--hairline-strong)"}`,
                  background: selected ? "var(--accent)" : "transparent",
                }}
              />
              <span className="inline-md" style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-body)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginRight: 8 }}>{opt.key}</span>
                {renderInline(opt.text)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
