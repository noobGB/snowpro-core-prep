/**
 * Parses the study plan (00) into PlanDay records. Day headings are H3s nested under a
 * "## Day-by-day" H2, each with a real ISO date plus a label in one of two confirmed formats —
 * a trailing parenthetical ("Thu 2026-08-13 (tonight, ~2-3 hrs)") for 6 of 7 days, or a trailing
 * em dash ("Wed 2026-08-19 — Exam day") for the last. One regex requiring the ISO date handles
 * both. Day parsing stops the moment any H2 appears after "Day-by-day" (in the real file that's
 * "## Progress tracker", which uses non-ISO "M/D" shorthand dates and isn't part of the plan).
 *
 * Checkbox state itself is discarded — the schema's task shape has no "done" field, since
 * checking a task off is app/progress state, not content. `links` come from real markdown links
 * in the task text (translated to app routes via the same filename classification the pipeline
 * uses for discovery), plus a fallback for bare "Domain N" mentions with no link at all.
 *
 * A task line may end with an optional bracketed tag -- {skip-ok}, {pin-early}, {mock:1},
 * {mock:2}, or {review} -- stripped from the displayed text and turned into `priority`/`role` on
 * the parsed PlanTask. This feeds app/src/lib/planDates.ts's crunch-mode compression (which day
 * groups may merge, which tasks are safe to demote when the exam is only a few real days out) —
 * see that file and issue #76 for the full design. Untagged tasks default to `priority: "must"`.
 */

import { visit } from "unist-util-visit";
import type { Heading, ListItem, RootContent } from "mdast";
import { classifyFiles } from "../discovery.js";
import type { PlanDay, PlanTask } from "../types.js";
import { domainId } from "../util/ids.js";
import { flattenText, headingText, parseMd } from "../util/markdown.js";

const DAY_HEADING_RE = /^\w{3} (\d{4}-\d{2}-\d{2})(?:\s*\(([^)]+)\)|\s*—\s*(.+))?$/;
const DAY_BY_DAY_HEADING_RE = /day-by-day/i;
const DOMAIN_MENTION_RE = /Domain\s*([1-5])/gi;

// Crunch-mode compression (app/src/lib/planDates.ts) needs per-task priority/role metadata that
// plain markdown has no room for -- an optional trailing bracketed tag on the task line carries it.
// Curly braces don't appear anywhere else in this content (verified across
// SnowPro_Notes_and_Questions/*.md), so this sigil can't collide with real prose or with the mock
// exam parser's own "**N. [Dx]**" square-bracket convention.
const TASK_TAG_RE = /\s*\{(skip-ok|pin-early|mock:1|mock:2|review)\}\s*$/i;
const TASK_ROLE: Record<string, PlanTask["role"]> = {
  "pin-early": "pin-early",
  "mock:1": "mock1",
  "mock:2": "mock2",
  review: "review",
};

function routeForFilename(filename: string): string | null {
  const [file] = classifyFiles([filename]).classified;
  if (!file) return null;
  if (file.kind === "domainNotes" && file.number) return `/notes/${domainId(file.number)}`;
  if (file.kind === "practiceQuestions") return "/practice";
  if (file.kind === "mockExam") return "/mocks";
  return null;
}

function collectTasks(nodes: RootContent[], dayIndex: number): PlanTask[] {
  const tasks: PlanTask[] = [];
  let taskIndex = 0;

  for (const node of nodes) {
    visit(node, "listItem", (item: ListItem) => {
      if (item.checked === null || item.checked === undefined) return;
      taskIndex += 1;

      const text = flattenText(item);
      const links = new Set<string>();
      visit(item, "link", (linkNode: { url: string }) => {
        const route = routeForFilename(linkNode.url);
        if (route) links.add(route);
      });
      for (const m of text.matchAll(DOMAIN_MENTION_RE)) {
        links.add(`/notes/${domainId(Number(m[1]))}`);
      }

      // Link extraction above runs against the full text/AST before the tag is stripped -- the
      // trailing "{...}" tag never contains a domain mention or a link, so stripping it after
      // doesn't affect what was already collected.
      const tagMatch = text.match(TASK_TAG_RE);
      const cleanText = tagMatch ? text.slice(0, tagMatch.index).trimEnd() : text;
      const tag = tagMatch?.[1]?.toLowerCase();
      const priority: PlanTask["priority"] = tag === "skip-ok" ? "skippable" : "must";
      const role = tag ? TASK_ROLE[tag] : undefined;

      tasks.push({ id: `p-${dayIndex}-${taskIndex}`, text: cleanText, links: [...links], priority, role });
    });
  }

  return tasks;
}

export function parseStudyPlan(raw: string): PlanDay[] {
  const root = parseMd(raw);
  const days: PlanDay[] = [];

  let inDaySection = false;
  let currentDate: string | null = null;
  let currentLabel = "";
  let currentNodes: RootContent[] = [];
  let dayIndex = 0;

  const finalizeDay = () => {
    if (currentDate) {
      dayIndex += 1;
      days.push({ date: currentDate, label: currentLabel, tasks: collectTasks(currentNodes, dayIndex) });
    }
    currentDate = null;
    currentLabel = "";
    currentNodes = [];
  };

  for (const node of root.children) {
    if (node.type === "heading" && (node as Heading).depth === 2) {
      const text = headingText(node as Heading);
      if (DAY_BY_DAY_HEADING_RE.test(text)) {
        inDaySection = true;
        continue;
      }
      if (inDaySection) {
        finalizeDay();
        break; // left the day-by-day section (e.g. "## Progress tracker") — nothing after matters
      }
      continue;
    }

    if (inDaySection && node.type === "heading" && (node as Heading).depth === 3) {
      const text = headingText(node as Heading);
      const m = text.match(DAY_HEADING_RE);
      if (m) {
        finalizeDay();
        currentDate = m[1] ?? null;
        currentLabel = (m[2] ?? m[3] ?? "").trim();
        continue;
      }
    }

    if (inDaySection) currentNodes.push(node);
  }
  finalizeDay();

  return days;
}
