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

      tasks.push({ id: `p-${dayIndex}-${taskIndex}`, text, links: [...links] });
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
