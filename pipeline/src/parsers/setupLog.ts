/**
 * Parses the setup log (15) into SetupItem records. The file has two top-level sections —
 * "## Setup Steps" (things to actually do, in order) and "## Known Issues & Fixes" (things that
 * went wrong along the way, told separately so a step's own instructions stay a clean checklist
 * rather than mixed with troubleshooting narrative) — plus a leading "## Status" section that
 * isn't either and is skipped. Every "### Step N"/"### Issue N" heading (and each "#### Na."
 * sub-heading nested under a step) becomes its own flat SetupItem, `kind` inherited from whichever
 * top-level section it's under. Ids are assigned by file-order position ("s-1", "s-2", ...), never
 * parsed from the heading text — kept that way deliberately, since the log stays append-only going
 * forward (new steps/issues get appended as they're actually encountered, history never rewritten)
 * and a future addition could reintroduce numbering drift; positional ids mean that can never
 * corrupt ids or collide, only the cosmetic step numbers (which is exactly what happened once
 * already — see this file's git history, fixed by renumbering the headings in place).
 *
 * Each entry's `summary` is its own "> **Summary:** ..." blockquote, required by convention
 * immediately under the heading — this is deliberately the ONLY thing the app's Setup page
 * renders inline; the full narrative stays in this file for whoever wants it, reachable via
 * `sourceAnchor` (a GitHub-slugified version of the heading text, for a "full details" deep link
 * back to this file on GitHub). `commands` are still extracted the same way as before (any
 * language-tagged fenced code block in the entry's range — untagged blocks are error/output text,
 * not commands, and are correctly excluded) since a copyable command is useful inline and isn't
 * what made the old page feel like a log dump; long prose paragraphs were the problem, and those
 * no longer get rendered at all.
 */

import { visit } from "unist-util-visit";
import type { Blockquote, Code, Heading, Paragraph, Root } from "mdast";
import type { SetupItem } from "../types.js";
import { SequentialId } from "../util/ids.js";
import { flattenText, headingText, parseMd } from "../util/markdown.js";

const SUMMARY_PREFIX_RE = /^Summary:\s*/i;

type Kind = "step" | "issue";

function sectionKind(h2Title: string): Kind | null {
  if (/^Setup Steps/i.test(h2Title)) return "step";
  if (/^Known Issues/i.test(h2Title)) return "issue";
  return null; // e.g. "## Status" -- a real section, just not one this parser turns into items
}

/** Best-effort match of GitHub's own heading-anchor algorithm: lowercase, strip anything that
 *  isn't a word character/space/hyphen (drops backticks, em dashes, punctuation entirely rather
 *  than substituting a hyphen), then replace each remaining space with its own hyphen (GitHub
 *  does not collapse runs of spaces into a single hyphen). */
function githubSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/ /g, "-");
}

interface Boundary {
  depth: 2 | 3 | 4;
  title: string;
  lineStart: number; // 1-based, the heading's own line
}

interface EntryDraft {
  id: string;
  kind: Kind;
  group: string;
  title: string;
  bodyStartLine: number; // 1-based, inclusive
  bodyEndLine: number; // 1-based, inclusive
  summary: string;
  commands: string[];
}

function collectBoundaries(root: Root): Boundary[] {
  const boundaries: Boundary[] = [];
  for (const node of root.children) {
    if (node.type !== "heading") continue;
    const h = node as Heading;
    if ((h.depth === 2 || h.depth === 3 || h.depth === 4) && h.position) {
      boundaries.push({ depth: h.depth, title: headingText(h), lineStart: h.position.start.line });
    }
  }
  return boundaries;
}

export function parseSetupLog(raw: string): SetupItem[] {
  const root = parseMd(raw);
  const lines = raw.split(/\r?\n/);
  const boundaries = collectBoundaries(root);
  const nextId = new SequentialId("s-");

  const entries: EntryDraft[] = [];
  let currentKind: Kind | null = null;
  let currentH3Index: number | null = null;

  boundaries.forEach((b, i) => {
    const nextLineStart = boundaries[i + 1]?.lineStart;
    const bodyStartLine = b.lineStart + 1;
    const bodyEndLine = (nextLineStart ?? lines.length + 1) - 1;

    if (b.depth === 2) {
      currentKind = sectionKind(b.title);
      currentH3Index = null;
      return;
    }

    if (b.depth === 3) {
      if (currentKind === null) return; // H3 outside "Setup Steps"/"Known Issues" (shouldn't happen) -- ignore
      entries.push({
        id: nextId.take(),
        kind: currentKind,
        group: b.title,
        title: b.title,
        bodyStartLine,
        bodyEndLine,
        summary: "",
        commands: [],
      });
      currentH3Index = entries.length - 1;
      return;
    }

    // depth 4
    if (currentKind === null || currentH3Index === null) return; // H4 outside a recognized Step -- ignore
    entries.push({
      id: nextId.take(),
      kind: currentKind,
      group: entries[currentH3Index]!.title,
      title: b.title,
      bodyStartLine,
      bodyEndLine,
      summary: "",
      commands: [],
    });
  });

  const entryFor = (line: number): EntryDraft | undefined =>
    entries.find((e) => line >= e.bodyStartLine && line <= e.bodyEndLine);

  visit(root, "code", (node: Code) => {
    if (!node.lang || !node.position) return;
    const entry = entryFor(node.position.start.line);
    if (entry) entry.commands.push(node.value);
  });

  visit(root, "blockquote", (node: Blockquote) => {
    if (!node.position) return;
    const entry = entryFor(node.position.start.line);
    if (!entry || entry.summary) return; // first blockquote in range wins
    const firstParagraph = node.children.find((c): c is Paragraph => c.type === "paragraph");
    if (!firstParagraph) return;
    const text = flattenText(firstParagraph);
    if (SUMMARY_PREFIX_RE.test(text)) entry.summary = text.replace(SUMMARY_PREFIX_RE, "");
  });

  return entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    group: e.group,
    title: e.title,
    summary: e.summary,
    commands: e.commands,
    sourceAnchor: githubSlug(e.title),
  }));
}
