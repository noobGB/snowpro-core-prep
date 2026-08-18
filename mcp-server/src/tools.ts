/**
 * Registers the MCP tools a conversational study agent uses: the original 6 quiz tools
 * (list_domains, get_readiness, start_quiz_session, get_next_question, submit_answer,
 * end_quiz_session) plus reset_progress, set_exam_date, get_study_plan, set_plan_task,
 * get_setup_checklist, and set_setup_step, covering the rest of what the web app's Dashboard,
 * Study plan, Setup, and Settings screens can do (excluding JSON import/export — awkward as a
 * chat action, better done as a direct file read/write when actually needed). Each handler is a
 * thin wrapper over session.ts — this file's only job is input validation (via zod) and mapping
 * session.ts's Result<T> into the SDK's { content, structuredContent } / { content, isError }
 * shapes.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBundle } from "../../pipeline/src/types.js";
import * as session from "./session.js";

function okResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> };
}
function errResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export function registerTools(server: McpServer, bundle: ContentBundle): void {
  server.registerTool(
    "list_domains",
    {
      description: "List the 5 SnowPro Core exam domains with their official weight and how many practice questions exist for each.",
      inputSchema: {},
      outputSchema: {
        domains: z.array(
          z.object({ id: z.string(), number: z.number(), title: z.string(), weight: z.number(), questionCount: z.number() }),
        ),
      },
    },
    async () => okResult(session.listDomains(bundle)),
  );

  server.registerTool(
    "get_readiness",
    {
      description:
        "Get the user's current readiness/weak-spot summary: an overall exam-readiness score (0-1000, weighted by domain weight) and a per-domain breakdown, based on their attempt history. Use this to decide what to quiz them on, or to report progress.",
      inputSchema: {},
      outputSchema: {
        overall: z.number().nullable(),
        measuredWeight: z.number(),
        domains: z.array(
          z.object({
            domainId: z.string(),
            title: z.string(),
            scaled: z.number().nullable(),
            lowSample: z.boolean(),
            attemptsUsed: z.number(),
          }),
        ),
      },
    },
    async () => okResult(session.getReadiness(bundle)),
  );

  server.registerTool(
    "start_quiz_session",
    {
      description:
        "Start a new quiz session. If domainId is omitted (and kind is not 'mock'), automatically picks the user's weakest domain based on readiness. Returns a sessionId to pass to get_next_question/submit_answer/end_quiz_session. Only one session can be active at a time (shared with the web app) — if one is already in progress, this errors unless discardExisting is true.",
      inputSchema: {
        domainId: z.string().optional().describe("e.g. 'd1'..'d5'. Omit to auto-pick the weakest domain."),
        kind: z.enum(["domain", "mock"]).optional().describe("Defaults to 'domain'. 'mock' starts a full-length mock exam instead."),
        setId: z.string().optional().describe("Advanced: start a specific set directly, bypassing domain/kind selection."),
        discardExisting: z.boolean().optional().describe("If true, abandon any existing in-progress session instead of erroring."),
      },
      outputSchema: {
        sessionId: z.string(),
        kind: z.enum(["domain", "mock"]),
        domainId: z.string().optional(),
        setId: z.string(),
        title: z.string(),
        totalQuestions: z.number(),
        startedAt: z.string(),
      },
    },
    async (input) => {
      const result = session.startSession(bundle, input);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );

  server.registerTool(
    "get_next_question",
    {
      description:
        "Get the next unanswered question in a session. Never includes the correct answer or explanation — call submit_answer to find out if the user was right. Returns done:true once every question in the session's set has been answered.",
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        done: z.boolean(),
        question: z
          .object({
            id: z.string(),
            domainId: z.string(),
            section: z.string().optional(),
            type: z.enum(["single", "multi"]),
            stem: z.string(),
            options: z.array(z.object({ key: z.string(), text: z.string() })),
          })
          .optional(),
      },
    },
    async ({ sessionId }) => {
      const result = session.getNextQuestion(bundle, sessionId);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );

  server.registerTool(
    "submit_answer",
    {
      description:
        "Grade the user's answer to a question. Pass 'picked' as option keys (e.g. [\"B\"], or [\"A\",\"C\"] for a multi-select question) — resolve the user's spoken/free-text answer to option keys yourself using the question+options you already have from get_next_question, don't pass raw text. For multi-select questions, credit can be partial (0 < credit < 1, verdict 'partial') — phrase feedback naturally using the returned verdict and explanation.",
      inputSchema: {
        sessionId: z.string(),
        questionId: z.string(),
        picked: z.array(z.string()).describe("Option key(s) the user chose, e.g. [\"B\"]. Empty array means unanswered/skipped."),
        timeSec: z.number().optional().describe("Roughly how long the user took to answer, if known."),
      },
      outputSchema: {
        credit: z.number(),
        verdict: z.enum(["correct", "partial", "incorrect"]),
        correctKeys: z.array(z.string()),
        explanation: z.string(),
        domainId: z.string(),
      },
    },
    async ({ sessionId, questionId, picked, timeSec }) => {
      const result = session.submitAnswer(bundle, sessionId, questionId, picked, timeSec ?? 0);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );

  server.registerTool(
    "end_quiz_session",
    {
      description:
        "Finish a quiz session and record it as an attempt (visible in the web app's Analytics too, since progress is shared). Any questions served but never answered count as unanswered (zero credit). Returns the final score and per-domain breakdown.",
      inputSchema: {
        sessionId: z.string(),
        status: z.enum(["complete", "partial"]).optional().describe("Defaults to 'complete' if every question was answered, else 'partial'."),
      },
      outputSchema: {
        id: z.string(),
        setId: z.string(),
        domainId: z.string().optional(),
        kind: z.enum(["domain", "mock"]),
        scaled: z.number(),
        rawPct: z.number(),
        byDomain: z.record(z.string(), z.object({ answered: z.number(), credit: z.number(), scaled: z.number() })),
        answeredCount: z.number(),
        totalCount: z.number(),
        status: z.enum(["complete", "partial"]),
      },
    },
    async ({ sessionId, status }) => {
      const result = session.endSession(bundle, sessionId, status);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );

  server.registerTool(
    "reset_progress",
    {
      description:
        "Wipe ALL progress — every attempt, readiness history, plan/setup checkmarks, and the exam date — back to a blank slate. Cannot be undone. Requires the user to have explicitly confirmed first; pass confirm:\"RESET\" (exact, case-sensitive) only after they have. Never call this speculatively or infer confirmation from a general 'yes'.",
      inputSchema: {
        confirm: z.string().describe('Must be the literal string "RESET", echoed back only after the user explicitly confirmed the wipe.'),
      },
      outputSchema: { reset: z.literal(true) },
    },
    async ({ confirm }) => {
      const result = session.resetProgress(confirm);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );

  server.registerTool(
    "set_exam_date",
    {
      description:
        "Set (or clear) the user's exam date. The study plan's day-by-day schedule shifts automatically to land the day before whatever date this is set to. Pass date:null to clear it back to the content's own default (today + the plan's length).",
      inputSchema: {
        date: z.string().nullable().describe('ISO date, "YYYY-MM-DD" (e.g. "2026-09-15"), or null to clear.'),
      },
      outputSchema: { examDate: z.string(), daysLeft: z.number() },
    },
    async ({ date }) => {
      const result = session.setExamDate(bundle, date);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );

  server.registerTool(
    "get_study_plan",
    {
      description:
        "Get the full day-by-day study plan, remapped against the live exam date, with each task's done/not-done status. Each day is flagged isToday/isPast so you can pick out 'today's tasks' without recomputing dates yourself.",
      inputSchema: {},
      outputSchema: {
        examDate: z.string(),
        days: z.array(
          z.object({
            date: z.string(),
            label: z.string(),
            isToday: z.boolean(),
            isPast: z.boolean(),
            tasks: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })),
          }),
        ),
      },
    },
    async () => okResult(session.getStudyPlan(bundle)),
  );

  server.registerTool(
    "set_plan_task",
    {
      description: "Mark one study-plan task done or not-done. Get valid taskIds from get_study_plan.",
      inputSchema: {
        taskId: z.string(),
        checked: z.boolean(),
      },
      outputSchema: { taskId: z.string(), checked: z.boolean() },
    },
    async ({ taskId, checked }) => {
      const result = session.setPlanTask(bundle, taskId, checked);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );

  server.registerTool(
    "get_setup_checklist",
    {
      description:
        "Get the hands-on Snowflake CLI/MCP setup checklist (id, group, title, done status only — not the full walkthrough text of each step). Use this to report progress or decide what to guide the user through next.",
      inputSchema: {},
      outputSchema: {
        steps: z.array(z.object({ id: z.string(), group: z.string(), title: z.string(), done: z.boolean() })),
        doneCount: z.number(),
        totalCount: z.number(),
      },
    },
    async () => okResult(session.getSetupChecklist(bundle)),
  );

  server.registerTool(
    "set_setup_step",
    {
      description: "Mark one hands-on setup step done or not-done. Get valid stepIds from get_setup_checklist.",
      inputSchema: {
        stepId: z.string(),
        checked: z.boolean(),
      },
      outputSchema: { stepId: z.string(), checked: z.boolean() },
    },
    async ({ stepId, checked }) => {
      const result = session.setSetupStep(bundle, stepId, checked);
      return result.ok ? okResult(result.value) : errResult(result.error);
    },
  );
}
