import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentBundle } from "../../pipeline/src/types.js";
import type { ProgressState } from "../../app/src/lib/progress.js";
import { defaultExamDate, isoDate } from "../../app/src/lib/planDates.js";

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y!, m! - 1, d! + days));
}

// Mock progressStore entirely so tests never touch the real ./data/progress.json — an in-memory
// mutable box standing in for the file, reset before every test.
let mockState: ProgressState = defaultState();
function defaultState(): ProgressState {
  return {
    schemaVersion: 1,
    examDate: null,
    lastLocation: null,
    attempts: [],
    inProgress: null,
    flashcards: { seen: [], lastIndex: 0, grades: {} },
    plan: { checked: [] },
    setup: { checked: [] },
    settings: { theme: "dark" },
  };
}

// updateProgress's real implementation retries on a concurrent-write conflict; these tests have
// only one writer, so the mock just applies `mutate` once against the shared in-memory state,
// same ok/err contract as the real thing.
type MutateResult<T> = { ok: true; next: ProgressState; value: T } | { ok: false; error: string };

vi.mock("../src/progressStore.js", () => ({
  readProgress: () => mockState,
  defaultProgressState: defaultState,
  updateProgress: <T,>(mutate: (state: ProgressState) => MutateResult<T>) => {
    const result = mutate(mockState);
    if (!result.ok) return result;
    mockState = result.next;
    return { ok: true, value: result.value };
  },
}));

const {
  startSession,
  getNextQuestion,
  submitAnswer,
  endSession,
  getReadiness,
  listDomains,
  resetProgress,
  setExamDate,
  getStudyPlan,
  setPlanTask,
  getSetupChecklist,
  setSetupStep,
} = await import("../src/session.js");

function fixtureBundle(): ContentBundle {
  const today = isoDate(new Date());
  const yesterday = shiftIso(today, -1);
  return {
    bankVersion: "sha256:test",
    generatedAt: new Date().toISOString(),
    generatedFrom: [],
    domains: [
      { id: "d1", number: 1, title: "Architecture", weight: 0.6, noteFile: "01.md", sections: [] },
      { id: "d2", number: 2, title: "Governance", weight: 0.4, noteFile: "02.md", sections: [] },
    ],
    questions: [
      { id: "d1-q1", domainId: "d1", type: "single", stem: "Q1", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], correct: ["B"], explanation: "exp1", sourceFile: "01.md", sourceIndex: 0 },
      { id: "d1-q2", domainId: "d1", type: "single", stem: "Q2", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], correct: ["A"], explanation: "exp2", sourceFile: "01.md", sourceIndex: 1 },
      { id: "d2-q1", domainId: "d2", type: "multi", stem: "Q3", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }], correct: ["A", "C"], explanation: "exp3", sourceFile: "02.md", sourceIndex: 0 },
    ],
    sets: [
      { id: "set-d1", kind: "domain", domainId: "d1", title: "Domain 1 Practice", questionIds: ["d1-q1", "d1-q2"], timed: false },
      { id: "set-d2", kind: "domain", domainId: "d2", title: "Domain 2 Practice", questionIds: ["d2-q1"], timed: false },
      { id: "mock-1", kind: "mock", title: "Mock Exam 1", questionIds: ["d1-q1", "d1-q2", "d2-q1"], timed: true, durationMin: 115, domainSplit: { d1: 2, d2: 1 } },
    ],
    flashcards: [],
    plan: [
      { date: yesterday, label: "Day 1", tasks: [{ id: "p-1", text: "Read domain 1 notes", links: [], priority: "must" }] },
      { date: today, label: "Day 2", tasks: [{ id: "p-2", text: "Practice domain 1", links: [], priority: "must" }] },
    ],
    resources: [],
    setup: [
      { id: "s-1", kind: "step", group: "Install", title: "Install CLI", summary: "", commands: [], sourceAnchor: "install-cli" },
      { id: "s-2", kind: "step", group: "Install", title: "Configure auth", summary: "", commands: [], sourceAnchor: "configure-auth" },
      { id: "s-3", kind: "issue", group: "Known Issues", title: "Known blocker", summary: "", commands: [], sourceAnchor: "known-blocker" },
    ],
  };
}

beforeEach(() => {
  mockState = defaultState();
});

describe("listDomains / getReadiness", () => {
  it("lists domains with question counts", () => {
    const out = listDomains(fixtureBundle());
    expect(out.domains).toEqual([
      { id: "d1", number: 1, title: "Architecture", weight: 0.6, questionCount: 2 },
      { id: "d2", number: 2, title: "Governance", weight: 0.4, questionCount: 1 },
    ]);
  });

  it("returns null readiness with no attempts", () => {
    const out = getReadiness(fixtureBundle());
    expect(out.overall).toBeNull();
    expect(out.domains.every((d) => d.scaled === null)).toBe(true);
  });
});

describe("startSession", () => {
  it("auto-picks the never-attempted domain over one with data", () => {
    const bundle = fixtureBundle();
    // d1 has a prior attempt (some data); d2 has none — d2 should be picked as more urgent.
    mockState.attempts.push({
      id: "prior", setId: "set-d1", kind: "domain", bankVersion: "sha256:test",
      startedAt: new Date().toISOString(), submittedAt: new Date().toISOString(), status: "complete",
      durationSec: 60, answers: {}, scaled: 800, rawPct: 0.8,
      byDomain: { d1: { answered: 2, credit: 1.6, scaled: 800 } },
    });

    const result = startSession(bundle, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.domainId).toBe("d2");
  });

  it("errors if a session is already in progress, unless discardExisting", () => {
    const bundle = fixtureBundle();
    const first = startSession(bundle, { domainId: "d1" });
    expect(first.ok).toBe(true);

    const second = startSession(bundle, { domainId: "d2" });
    expect(second.ok).toBe(false);

    const third = startSession(bundle, { domainId: "d2", discardExisting: true });
    expect(third.ok).toBe(true);
  });

  it("starts a mock session covering all sets' questions", () => {
    const bundle = fixtureBundle();
    const result = startSession(bundle, { kind: "mock" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.totalQuestions).toBe(3);
  });
});

describe("get_next_question / submit_answer flow", () => {
  it("serves questions once each, excluding answered and pending", () => {
    const bundle = fixtureBundle();
    const started = startSession(bundle, { domainId: "d1" });
    if (!started.ok) throw new Error("setup failed");
    const sessionId = started.value.sessionId;

    const q1 = getNextQuestion(bundle, sessionId);
    expect(q1.ok && !q1.value.done).toBe(true);
    const firstId = q1.ok && !q1.value.done ? q1.value.question!.id : undefined;

    // Calling again before answering must not re-serve the same (pending) question.
    const q2 = getNextQuestion(bundle, sessionId);
    expect(q2.ok && !q2.value.done ? q2.value.question!.id : undefined).not.toBe(firstId);

    if (q2.ok && !q2.value.done) {
      const sub = submitAnswer(bundle, sessionId, q2.value.question!.id, ["A"], 10);
      expect(sub.ok).toBe(true);
    }
    if (firstId) submitAnswer(bundle, sessionId, firstId, ["B"], 5);

    const q3 = getNextQuestion(bundle, sessionId);
    expect(q3.ok && q3.value.done).toBe(true);
  });

  it("grades single-select exactly right/wrong", () => {
    const bundle = fixtureBundle();
    const started = startSession(bundle, { domainId: "d1" });
    if (!started.ok) throw new Error("setup failed");

    const correct = submitAnswer(bundle, started.value.sessionId, "d1-q1", ["B"], 0);
    expect(correct.ok && correct.value.credit).toBe(1);
    expect(correct.ok && correct.value.verdict).toBe("correct");

    const wrong = submitAnswer(bundle, started.value.sessionId, "d1-q2", ["B"], 0);
    expect(wrong.ok && wrong.value.credit).toBe(0);
    expect(wrong.ok && wrong.value.verdict).toBe("incorrect");
  });

  it("grades multi-select with partial credit", () => {
    const bundle = fixtureBundle();
    const started = startSession(bundle, { domainId: "d2" });
    if (!started.ok) throw new Error("setup failed");

    // correct = ["A","C"]; picking just "A" = 1 correct, 0 incorrect => credit 0.5
    const partial = submitAnswer(bundle, started.value.sessionId, "d2-q1", ["A"], 0);
    expect(partial.ok && partial.value.credit).toBe(0.5);
    expect(partial.ok && partial.value.verdict).toBe("partial");
  });
});

describe("endSession", () => {
  it("builds an Attempt matching scoring.ts's exact formulas, including unanswered questions", () => {
    const bundle = fixtureBundle();
    const started = startSession(bundle, { domainId: "d1" });
    if (!started.ok) throw new Error("setup failed");
    const sessionId = started.value.sessionId;

    submitAnswer(bundle, sessionId, "d1-q1", ["B"], 0); // correct, credit 1
    // d1-q2 left unanswered — should count as credit 0, not error.

    const ended = endSession(bundle, sessionId);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;

    expect(ended.value.answeredCount).toBe(1);
    expect(ended.value.totalCount).toBe(2);
    expect(ended.value.status).toBe("partial");
    expect(ended.value.scaled).toBe(500); // 1 credit / 2 questions * 1000
    expect(ended.value.byDomain.d1).toEqual({ answered: 1, credit: 1, scaled: 500 });

    // Persisted to (mocked) progress: attempts grew, inProgress cleared.
    expect(mockState.attempts).toHaveLength(1);
    expect(mockState.inProgress).toBeNull();
  });

  it("marks status complete when every question was answered", () => {
    const bundle = fixtureBundle();
    const started = startSession(bundle, { domainId: "d2" });
    if (!started.ok) throw new Error("setup failed");
    submitAnswer(bundle, started.value.sessionId, "d2-q1", ["A", "C"], 0);

    const ended = endSession(bundle, started.value.sessionId);
    expect(ended.ok && ended.value.status).toBe("complete");
    expect(ended.ok && ended.value.scaled).toBe(1000);
  });
});

describe("resetProgress", () => {
  it("rejects anything but the exact confirm phrase, leaving state untouched", () => {
    mockState.examDate = "2026-01-01";

    const bad = resetProgress("yes please");
    expect(bad.ok).toBe(false);
    expect(mockState.examDate).toBe("2026-01-01");
  });

  it("wipes everything back to default on the exact phrase", () => {
    mockState.examDate = "2026-01-01";
    mockState.attempts.push({
      id: "a1", setId: "set-d1", kind: "domain", bankVersion: "sha256:test",
      startedAt: new Date().toISOString(), submittedAt: new Date().toISOString(), status: "complete",
      durationSec: 10, answers: {}, scaled: 900, rawPct: 0.9, byDomain: {},
    });
    mockState.plan.checked.push("p-1");

    const result = resetProgress("RESET");
    expect(result.ok).toBe(true);
    expect(mockState.examDate).toBeNull();
    expect(mockState.attempts).toEqual([]);
    expect(mockState.plan.checked).toEqual([]);
  });
});

describe("setExamDate", () => {
  it("sets a valid future date and computes daysLeft", () => {
    const bundle = fixtureBundle();
    const future = shiftIso(isoDate(new Date()), 10);

    const result = setExamDate(bundle, future);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examDate).toBe(future);
      expect(result.value.daysLeft).toBe(10);
    }
    expect(mockState.examDate).toBe(future);
  });

  it("rejects a malformed date and leaves state untouched", () => {
    const bundle = fixtureBundle();
    const result = setExamDate(bundle, "next tuesday");
    expect(result.ok).toBe(false);
    expect(mockState.examDate).toBeNull();
  });

  it("clears back to the content-derived default when passed null", () => {
    const bundle = fixtureBundle();
    mockState.examDate = "2026-01-01";

    const result = setExamDate(bundle, null);
    expect(result.ok).toBe(true);
    expect(mockState.examDate).toBeNull();
    if (result.ok) expect(result.value.examDate).toBe(defaultExamDate(bundle.plan));
  });
});

describe("getStudyPlan / setPlanTask", () => {
  it("flags today/past correctly and reflects checked tasks", () => {
    const bundle = fixtureBundle();
    const today = isoDate(new Date());
    setExamDate(bundle, today); // offset 0: the plan's last day (today) maps to itself

    const before = getStudyPlan(bundle);
    expect(before.days).toHaveLength(2);
    expect(before.days[0]!.isPast).toBe(true);
    expect(before.days[0]!.isToday).toBe(false);
    expect(before.days[1]!.isToday).toBe(true);
    expect(before.days[1]!.tasks[0]!.done).toBe(false);

    const set = setPlanTask(bundle, "p-2", true);
    expect(set.ok).toBe(true);

    const after = getStudyPlan(bundle);
    expect(after.days[1]!.tasks[0]!.done).toBe(true);
    expect(after.days[0]!.tasks[0]!.done).toBe(false);
  });

  it("errors on an unknown task id without touching state", () => {
    const bundle = fixtureBundle();
    const result = setPlanTask(bundle, "no-such-task", true);
    expect(result.ok).toBe(false);
    expect(mockState.plan.checked).toEqual([]);
  });

  it("can uncheck a previously-checked task", () => {
    const bundle = fixtureBundle();
    setPlanTask(bundle, "p-1", true);
    expect(mockState.plan.checked).toContain("p-1");

    setPlanTask(bundle, "p-1", false);
    expect(mockState.plan.checked).not.toContain("p-1");
  });
});

describe("getSetupChecklist / setSetupStep", () => {
  it("reports done counts and toggles a step", () => {
    const bundle = fixtureBundle();
    const before = getSetupChecklist(bundle);
    expect(before.totalCount).toBe(3);
    expect(before.doneCount).toBe(0);

    const set = setSetupStep(bundle, "s-1", true);
    expect(set.ok).toBe(true);

    const after = getSetupChecklist(bundle);
    expect(after.doneCount).toBe(1);
    expect(after.steps.find((s) => s.id === "s-1")!.done).toBe(true);
    expect(after.steps.find((s) => s.id === "s-2")!.done).toBe(false);
  });

  it("surfaces kind so a caller can tell an actionable step from a known issue", () => {
    const bundle = fixtureBundle();
    const { steps } = getSetupChecklist(bundle);
    expect(steps.find((s) => s.id === "s-1")!.kind).toBe("step");
    expect(steps.find((s) => s.id === "s-3")!.kind).toBe("issue");
  });

  it("errors on an unknown step id without touching state", () => {
    const bundle = fixtureBundle();
    const result = setSetupStep(bundle, "no-such-step", true);
    expect(result.ok).toBe(false);
    expect(mockState.setup.checked).toEqual([]);
  });
});
