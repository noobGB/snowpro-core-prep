/**
 * Parses the cheatsheet (08) into Flashcard records. Confirmed on disk: 21 "##" topic headings,
 * a mix of bulleted "**Term**: value" entries, bare paragraphs with no bullet at all, sentence-only
 * bullets with no bold term, and exactly one markdown table.
 *
 * Front/back split: when a bullet's (or bare paragraph's) first inline child is a bold span
 * immediately followed by a colon — optionally with a parenthetical qualifier in between, e.g.
 * "**Search Optimization Service** (Enterprise+): ..." — front is the bold text and back is
 * everything after it (a leading bare ":" is stripped, but a parenthetical-then-colon is kept
 * verbatim in back, since it's meaningful content). Anything that doesn't fit that shape falls
 * back to front = the enclosing topic heading, back = the full bullet/paragraph text — a
 * deterministic rule, not a guess (e.g. "Notify → Suspend (...) → Suspend Immediately (...)."
 * has a bold first word but no colon, so it correctly falls back rather than mis-splitting).
 *
 * No entry is domain-tagged in the source, so domainId comes from a small hardcoded,
 * hand-reviewable heading -> domain lookup (verified against each domain's actual topic
 * coverage) rather than any kind of content-based guessing.
 */

import { toString as mdastToString } from "mdast-util-to-string";
import type { Heading, List, ListItem, Paragraph, PhrasingContent, Table, TableCell, TableRow } from "mdast";
import type { Flashcard } from "../types.js";
import { SequentialId } from "../util/ids.js";
import { flattenText, headingText, parseMd } from "../util/markdown.js";

const TOPIC_TO_DOMAIN: Record<string, string | null> = {
  "Exam logistics": null,
  "Editions (strict superset order)": "d1",
  "Time Travel / Fail-safe": "d5",
  "Table types vs. Time Travel / Fail-safe": "d5",
  "Micro-partitions": "d1",
  "Warehouse sizing": "d4",
  Caching: "d4",
  "VARIANT column": "d1",
  "COPY INTO / load metadata": "d3",
  "Roles (broadest → narrowest, know the hierarchy)": "d2",
  "Resource monitor actions (at threshold %)": "d2",
  "Data sharing": "d5",
  Scaling: "d4",
  "Stored procedure execution context": "d2",
  "DELETE vs TRUNCATE": "d4",
  "Streams survive cloning — but lose their state": "d3",
  "Query Acceleration Service (QAS) vs Search Optimization Service": "d4",
  "COPY INTO option to remember precisely": "d3",
  "Roles: account role vs. database role": "d2",
  "Account identifiers": "d2",
  'Marketplace listing terminology (current, replaces "Data Exchange")': "d5",
};

const BOLD_COLON_LEAD_RE = /^(?:\([^)]*\))?\s*:/;

function cellText(cell: TableCell): string {
  return flattenText(cell);
}

/** Splits a bullet/paragraph's flattened text into a front/back pair if its first inline child
 *  is a bold span immediately (optionally through a parenthetical) followed by a colon. */
function splitBoldColon(children: PhrasingContent[]): { front: string; back: string } | null {
  const first = children[0];
  if (!first || first.type !== "strong") return null;

  const front = flattenText(first);
  // Joined without a separator (not flattenText per-child) so inter-node word boundaries aren't
  // altered; whitespace — including any embedded line-wrap newline — is collapsed afterward.
  const remaining = children
    .slice(1)
    .map((c) => mdastToString(c))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  if (!BOLD_COLON_LEAD_RE.test(remaining)) return null;
  const back = remaining.replace(/^:\s*/, "");
  return { front, back };
}

function paragraphOf(node: ListItem | Paragraph): Paragraph | null {
  if (node.type === "paragraph") return node;
  const firstChild = node.children[0];
  return firstChild?.type === "paragraph" ? firstChild : null;
}

export function parseCheatsheet(raw: string): Flashcard[] {
  const root = parseMd(raw);
  const cards: Flashcard[] = [];
  const nextId = new SequentialId("fc-");

  let currentTopic = "";
  let currentDomain: string | null = null;

  const addCard = (front: string, back: string) => {
    if (!front.trim() || !back.trim()) return;
    cards.push({
      id: nextId.take(),
      front: front.trim(),
      back: back.trim(),
      domainId: currentDomain,
      source: "08_Cheatsheet_Key_Numbers.md",
    });
  };

  for (const node of root.children) {
    if (node.type === "heading" && (node as Heading).depth === 2) {
      currentTopic = headingText(node as Heading);
      currentDomain = TOPIC_TO_DOMAIN[currentTopic] ?? null;
      continue;
    }

    if (node.type === "list") {
      for (const item of (node as List).children) {
        const p = paragraphOf(item);
        if (!p) continue;
        const split = splitBoldColon(p.children);
        if (split) addCard(split.front, split.back);
        else addCard(currentTopic, flattenText(p));
      }
      continue;
    }

    if (node.type === "paragraph") {
      const p = node as Paragraph;
      const split = splitBoldColon(p.children);
      if (split) addCard(split.front, split.back);
      else addCard(currentTopic, flattenText(p));
      continue;
    }

    if (node.type === "table") {
      const table = node as Table;
      const [headerRow, ...dataRows] = table.children as TableRow[];
      if (!headerRow) continue;
      const headerCells = headerRow.children;
      for (const row of dataRows) {
        const cells = row.children;
        const rowLabel = cells[0] ? cellText(cells[0]) : "";
        const front = `${currentTopic}: ${rowLabel}`;
        const back = headerCells
          .slice(1)
          .map((h, i) => `${cellText(h)}: ${cells[i + 1] ? cellText(cells[i + 1]!) : ""}`)
          .join(", ");
        addCard(front, back);
      }
    }
  }

  return cards;
}
