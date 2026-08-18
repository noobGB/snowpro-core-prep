/**
 * Session lifecycle: picking a weak domain, serving questions, grading answers, and building the
 * final Attempt object — all backed by the shared progress.json (progressStore.ts) as the source
 * of truth for what's answered, so a killed/restarted process loses at most one in-flight
 * question, never a whole session. The only purely in-memory state is `servedPending`: questions
 * handed out by get_next_question but not yet answered, so a repeated call doesn't double-serve
 * the same question before it's been graded.
 *
 * Grading, scaling, and per-domain breakdown all reuse app/src/lib/scoring.ts exactly — this file
 * never reimplements that math. Weak-domain picking reuses app/src/lib/readiness.ts exactly.
 */

import { randomUUID } from "node:crypto";
import { byDomainBreakdown, questionCredit, scaledScore } from "../../app/src/lib/scoring.js";
import { overallReadiness, pickWeakestDomain } from "../../app/src/lib/readiness.js";
import { daysBetweenIso, defaultExamDate, isoDate, remapPlan } from "../../app/src/lib/planDates.js";
import { defaultProgressState, readProgress, updateProgress } from "./progressStore.js";
import type { ContentBundle, Question } from "../../pipeline/src/types.js";
import type { Attempt, AttemptAnswer, InProgressAttempt, ProgressState } from "../../app/src/lib/progress.js";

const servedPending = new Map<string, Set<string>>();

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
function err<T>(error: string): Result<T> {
  return { ok: false, error };
}

export interface StartSessionInput {
  domainId?: string;
  kind?: "domain" | "mock";
  setId?: string;
  discardExisting?: boolean;
}

export interface StartSessionOutput {
  sessionId: string;
  kind: "domain" | "mock";
  domainId?: string;
  setId: string;
  title: string;
  totalQuestions: number;
  startedAt: string;
}

export function startSession(bundle: ContentBundle, input: StartSessionInput): Result<StartSessionOutput> {
  // Fixed before the retry loop so a conflict-retry can't hand out a different id/timestamp for
  // what the caller experiences as one start_quiz_session call.
  const sessionId = randomUUID();
  const startedAt = new Date().toISOString();

  const outcome = updateProgress((progress) => {
    if (progress.inProgress && !input.discardExisting) {
      return {
        ok: false,
        error:
          `An in-progress session already exists (id ${progress.inProgress.id}, set ${progress.inProgress.setId}, ` +
          `started ${progress.inProgress.startedAt}). Pass discardExisting:true to abandon it, or finish it first ` +
          `with end_quiz_session.`,
      };
    }

    let set;
    if (input.setId) {
      set = bundle.sets.find((s) => s.id === input.setId);
      if (!set) return { ok: false, error: `Unknown setId "${input.setId}".` };
    } else if (input.kind === "mock") {
      set = bundle.sets.find((s) => s.kind === "mock");
      if (!set) return { ok: false, error: "No mock exam set is available in the content bundle." };
    } else {
      const domainId = input.domainId ?? pickWeakestDomain(bundle, progress.attempts);
      if (!domainId) return { ok: false, error: "Could not determine a domain to quiz on (no domains in content bundle)." };
      set = bundle.sets.find((s) => s.domainId === domainId && s.kind === "domain");
      if (!set) return { ok: false, error: `No domain practice set found for domainId "${domainId}".` };
    }

    const inProgress: InProgressAttempt = {
      id: sessionId,
      setId: set.id,
      kind: set.kind,
      bankVersion: bundle.bankVersion,
      startedAt,
      answers: {},
    };
    return {
      ok: true,
      next: { ...progress, inProgress },
      value: {
        sessionId,
        kind: set.kind,
        domainId: set.domainId,
        setId: set.id,
        title: set.title,
        totalQuestions: set.questionIds.length,
        startedAt,
      } as StartSessionOutput,
    };
  });

  if (!outcome.ok) return err(outcome.error);
  servedPending.set(sessionId, new Set());
  return ok(outcome.value);
}

/** Pure validator, safe to call against any progress snapshot — including a freshly-reread one on
 *  each attempt inside updateProgress()'s retry loop, not just the first read. */
function requireActiveSession(progress: ProgressState, sessionId: string): Result<InProgressAttempt> {
  if (!progress.inProgress || progress.inProgress.id !== sessionId) {
    return err(
      `No active session with id "${sessionId}". Call start_quiz_session first (or it may have already ` +
        `been ended).`,
    );
  }
  return ok(progress.inProgress);
}

function activeSession(sessionId: string) {
  const progress = readProgress();
  const active = requireActiveSession(progress, sessionId);
  if (!active.ok) return err<{ progress: ProgressState; inProgress: InProgressAttempt }>(active.error);
  return ok({ progress, inProgress: active.value });
}

export interface NextQuestionOutput {
  done: boolean;
  question?: {
    id: string;
    domainId: string;
    section?: string;
    type: "single" | "multi";
    stem: string;
    options: { key: string; text: string }[];
  };
}

export function getNextQuestion(bundle: ContentBundle, sessionId: string): Result<NextQuestionOutput> {
  const active = activeSession(sessionId);
  if (!active.ok) return err(active.error);
  const { inProgress } = active.value;

  const set = bundle.sets.find((s) => s.id === inProgress.setId);
  if (!set) return err(`This session's set ("${inProgress.setId}") no longer exists in the content bundle.`);

  const pending = servedPending.get(sessionId) ?? new Set<string>();
  const answered = new Set(Object.keys(inProgress.answers));
  const nextId = set.questionIds.find((id) => !answered.has(id) && !pending.has(id));

  if (!nextId) return ok({ done: true });

  const question = bundle.questions.find((q) => q.id === nextId);
  if (!question) return err(`Question "${nextId}" is referenced by set "${set.id}" but missing from the bundle.`);

  pending.add(nextId);
  servedPending.set(sessionId, pending);

  return ok({
    done: false,
    question: {
      id: question.id,
      domainId: question.domainId,
      section: question.section,
      type: question.type,
      stem: question.stem,
      options: question.options,
    },
  });
}

export interface SubmitAnswerOutput {
  credit: number;
  verdict: "correct" | "partial" | "incorrect";
  correctKeys: string[];
  explanation: string;
  domainId: string;
}

export function submitAnswer(
  bundle: ContentBundle,
  sessionId: string,
  questionId: string,
  picked: string[],
  timeSec: number,
): Result<SubmitAnswerOutput> {
  const question = bundle.questions.find((q) => q.id === questionId);
  if (!question) return err(`Unknown questionId "${questionId}".`);

  const credit = questionCredit(question, picked);
  const verdict: SubmitAnswerOutput["verdict"] = credit === 1 ? "correct" : credit === 0 ? "incorrect" : "partial";
  const value: SubmitAnswerOutput = { credit, verdict, correctKeys: question.correct, explanation: question.explanation, domainId: question.domainId };

  const outcome = updateProgress((progress) => {
    const active = requireActiveSession(progress, sessionId);
    if (!active.ok) return { ok: false, error: active.error };
    const inProgress = active.value;

    const nextInProgress: InProgressAttempt = {
      ...inProgress,
      answers: { ...inProgress.answers, [questionId]: { picked, timeSec } },
    };
    return { ok: true, next: { ...progress, inProgress: nextInProgress }, value: undefined };
  });

  if (!outcome.ok) return err(outcome.error);
  servedPending.get(sessionId)?.delete(questionId);
  return ok(value);
}

export interface EndSessionOutput {
  id: string;
  setId: string;
  domainId?: string;
  kind: "domain" | "mock";
  scaled: number;
  rawPct: number;
  byDomain: Record<string, { answered: number; credit: number; scaled: number }>;
  answeredCount: number;
  totalCount: number;
  status: "complete" | "partial";
}

export function endSession(
  bundle: ContentBundle,
  sessionId: string,
  statusOverride?: "complete" | "partial",
): Result<EndSessionOutput> {
  const outcome = updateProgress((progress) => {
    const active = requireActiveSession(progress, sessionId);
    if (!active.ok) return { ok: false, error: active.error };
    const inProgress = active.value;

    const set = bundle.sets.find((s) => s.id === inProgress.setId);
    if (!set) return { ok: false, error: `This session's set ("${inProgress.setId}") no longer exists in the content bundle.` };

    const questions: Question[] = bundle.questions.filter((q) => set.questionIds.includes(q.id));

    let totalCredit = 0;
    const answerRecords: Record<string, AttemptAnswer> = {};
    const answersAsPickedMap: Record<string, string[]> = {};
    for (const q of questions) {
      const a = inProgress.answers[q.id];
      const picked = a?.picked ?? [];
      const credit = questionCredit(q, picked);
      totalCredit += credit;
      answerRecords[q.id] = { picked, correct: credit === 1, credit, timeSec: a?.timeSec ?? 0 };
      answersAsPickedMap[q.id] = picked;
    }

    const answeredCount = Object.keys(inProgress.answers).length;
    const status: "complete" | "partial" = statusOverride ?? (answeredCount >= questions.length ? "complete" : "partial");
    const durationSec = Math.max(0, Math.round((Date.now() - new Date(inProgress.startedAt).getTime()) / 1000));

    const attempt: Attempt = {
      id: inProgress.id,
      setId: set.id,
      kind: set.kind,
      bankVersion: bundle.bankVersion,
      startedAt: inProgress.startedAt,
      submittedAt: new Date().toISOString(),
      status,
      durationSec,
      answers: answerRecords,
      scaled: scaledScore(totalCredit, questions.length),
      rawPct: questions.length > 0 ? totalCredit / questions.length : 0,
      byDomain: byDomainBreakdown(questions, answersAsPickedMap),
    };

    return {
      ok: true,
      next: { ...progress, attempts: [...progress.attempts, attempt], inProgress: null },
      value: {
        id: attempt.id,
        setId: attempt.setId,
        domainId: set.domainId,
        kind: attempt.kind,
        scaled: attempt.scaled,
        rawPct: attempt.rawPct,
        byDomain: attempt.byDomain,
        answeredCount,
        totalCount: questions.length,
        status,
      } as EndSessionOutput,
    };
  });

  if (!outcome.ok) return err(outcome.error);
  servedPending.delete(sessionId);
  return ok(outcome.value);
}

export interface ReadinessOutput {
  overall: number | null;
  measuredWeight: number;
  domains: {
    domainId: string;
    title: string;
    scaled: number | null;
    earnedPoints: number | null;
    maxPoints: number;
    lowSample: boolean;
    attemptsUsed: number;
  }[];
}

export function getReadiness(bundle: ContentBundle): ReadinessOutput {
  const progress = readProgress();
  const readiness = overallReadiness(bundle, progress.attempts);
  return {
    overall: readiness.overall,
    measuredWeight: readiness.measuredWeight,
    domains: readiness.perDomain.map((d) => ({
      ...d,
      title: bundle.domains.find((x) => x.id === d.domainId)?.title ?? d.domainId,
    })),
  };
}

export interface ListDomainsOutput {
  domains: { id: string; number: number; title: string; weight: number; questionCount: number }[];
}

export function listDomains(bundle: ContentBundle): ListDomainsOutput {
  return {
    domains: bundle.domains.map((d) => {
      const set = bundle.sets.find((s) => s.domainId === d.id && s.kind === "domain");
      return { id: d.id, number: d.number, title: d.title, weight: d.weight, questionCount: set?.questionIds.length ?? 0 };
    }),
  };
}

const RESET_CONFIRM_PHRASE = "RESET";

export interface ResetProgressOutput {
  reset: true;
}

/** Mirrors SettingsPanel.tsx's typed-confirmation reset exactly (same phrase) — this wipes
 *  attempts, plan/setup checkmarks, exam date, everything, with no way back. Requiring the caller
 *  to echo the literal phrase (not just a boolean) makes it very unlikely a stray "yes" earlier in
 *  a conversation accidentally triggers it. */
export function resetProgress(confirm: string): Result<ResetProgressOutput> {
  if (confirm !== RESET_CONFIRM_PHRASE) {
    return err(`Pass confirm:"${RESET_CONFIRM_PHRASE}" (exact match) to actually wipe all progress — this cannot be undone. Make sure the user has explicitly confirmed first.`);
  }
  const outcome = updateProgress(() => ({ ok: true, next: defaultProgressState(), value: { reset: true as const } }));
  return outcome.ok ? ok(outcome.value) : err(outcome.error);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface SetExamDateOutput {
  examDate: string;
  /** Calendar days from today to the exam date. Negative means the date has already passed. */
  daysLeft: number;
}

export function setExamDate(bundle: ContentBundle, date: string | null): Result<SetExamDateOutput> {
  if (date !== null && !ISO_DATE_RE.test(date)) {
    return err(`Invalid date "${date}" — must be an ISO date string ("YYYY-MM-DD"), or null to clear it back to the plan's own default.`);
  }

  const outcome = updateProgress((progress) => ({ ok: true, next: { ...progress, examDate: date }, value: undefined }));
  if (!outcome.ok) return err(outcome.error);

  const resolvedExamDate = date ?? defaultExamDate(bundle.plan);
  return ok({ examDate: resolvedExamDate, daysLeft: daysBetweenIso(isoDate(new Date()), resolvedExamDate) });
}

export interface StudyPlanTaskOutput {
  id: string;
  text: string;
  done: boolean;
}

export interface StudyPlanDayOutput {
  date: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  tasks: StudyPlanTaskOutput[];
}

export interface GetStudyPlanOutput {
  examDate: string;
  days: StudyPlanDayOutput[];
}

/** Same remapping Dashboard/StudyPlan use in the web app (lib/planDates.ts's remapPlan): plan days
 *  shift to land relative to the live exam date, never the plan's original source dates. */
export function getStudyPlan(bundle: ContentBundle): GetStudyPlanOutput {
  const progress = readProgress();
  const examDate = progress.examDate ?? defaultExamDate(bundle.plan);
  const todayIso = isoDate(new Date());

  const days = remapPlan(bundle.plan, examDate).map((day) => ({
    date: day.displayDate,
    label: day.label,
    isToday: day.displayDate === todayIso,
    isPast: day.displayDate < todayIso,
    tasks: day.tasks.map((t) => ({ id: t.id, text: t.text, done: progress.plan.checked.includes(t.id) })),
  }));

  return { examDate, days };
}

export interface SetPlanTaskOutput {
  taskId: string;
  checked: boolean;
}

export function setPlanTask(bundle: ContentBundle, taskId: string, checked: boolean): Result<SetPlanTaskOutput> {
  const known = bundle.plan.some((day) => day.tasks.some((t) => t.id === taskId));
  if (!known) return err(`Unknown study plan task id "${taskId}". Call get_study_plan to see valid task ids.`);

  const outcome = updateProgress((progress) => {
    const current = progress.plan.checked;
    const next = checked ? (current.includes(taskId) ? current : [...current, taskId]) : current.filter((id) => id !== taskId);
    return { ok: true, next: { ...progress, plan: { checked: next } }, value: { taskId, checked } };
  });
  return outcome.ok ? ok(outcome.value) : err(outcome.error);
}

export interface SetupStepStatusOutput {
  id: string;
  group: string;
  title: string;
  done: boolean;
}

export interface GetSetupChecklistOutput {
  steps: SetupStepStatusOutput[];
  doneCount: number;
  totalCount: number;
}

/** Deliberately just id/group/title/done — not the full step body/commands/gotchas, which would
 *  bloat every status check. Read the source setup-log markdown directly for the full walkthrough
 *  text of a specific step when actually guiding the user through it. */
export function getSetupChecklist(bundle: ContentBundle): GetSetupChecklistOutput {
  const progress = readProgress();
  const steps = bundle.setup.map((s) => ({ id: s.id, group: s.group, title: s.title, done: progress.setup.checked.includes(s.id) }));
  return { steps, doneCount: steps.filter((s) => s.done).length, totalCount: steps.length };
}

export interface SetSetupStepOutput {
  stepId: string;
  checked: boolean;
}

export function setSetupStep(bundle: ContentBundle, stepId: string, checked: boolean): Result<SetSetupStepOutput> {
  const known = bundle.setup.some((s) => s.id === stepId);
  if (!known) return err(`Unknown setup step id "${stepId}". Call get_setup_checklist to see valid step ids.`);

  const outcome = updateProgress((progress) => {
    const current = progress.setup.checked;
    const next = checked ? (current.includes(stepId) ? current : [...current, stepId]) : current.filter((id) => id !== stepId);
    return { ok: true, next: { ...progress, setup: { checked: next } }, value: { stepId, checked } };
  });
  return outcome.ok ? ok(outcome.value) : err(outcome.error);
}
