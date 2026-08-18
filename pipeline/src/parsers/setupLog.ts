/**
 * Parses the setup log (15) into SetupItem records. The "## Step N — Title" headings are
 * sequential and in file order (renumbered 2026-08-18 — an earlier append to the log had reused
 * "Step 9"/"Step 10" for two unrelated entries each, landing out of numeric order relative to the
 * MCP-server section inserted between them; fixed by renumbering the headings in place, without
 * reordering any content, since the log's own convention is to append new steps as they're
 * actually encountered rather than reorder history). Ids are still assigned by file-order position
 * ("s-1", "s-2", ...), never parsed from the heading text — kept that way deliberately, since the
 * log stays append-only going forward and a future addition could reintroduce the same numbering
 * drift; positional ids mean that can never corrupt ids or duplicate/collide, only the cosmetic
 * step numbers, same as this fix just corrected. A leading "## Status" section (before any
 * "## Step" heading) is not a step and is skipped.
 *
 * H2 steps and their nested H3 sub-steps (e.g. "### 7a. Generate the key pair") each become their
 * own flat entry — group = the owning H2's text either way, title = that heading's own text.
 * `body` is a byte-faithful raw-line slice (not a remark-serialized re-render, which could subtly
 * reformat the source). `commands` come from any language-tagged fenced code block in an entry's
 * range (untagged blocks are error/output text, confirmed real, and are correctly excluded).
 * `gotchas` are scanned two ways since the source marks them three inconsistent ways: any
 * paragraph whose flattened text contains "gotcha" ANYWHERE (not just at the start — two real
 * cases, a mid-paragraph mention and a bold prefix that doesn't start with the word itself, would
 * be missed by an anchored match), and any child H3 heading containing "gotcha" (attached to the
 * parent H2's gotchas array, in addition to the H3 having its own entry).
 */

import { visit } from "unist-util-visit";
import type { Code, Heading, Paragraph, Root } from "mdast";
import type { SetupItem } from "../types.js";
import { SequentialId } from "../util/ids.js";
import { flattenText, headingText, parseMd } from "../util/markdown.js";

const STEP_HEADING_RE = /^Step \d+/i;
const GOTCHA_RE = /\bgotcha\b/i;

interface Boundary {
  depth: 2 | 3;
  title: string;
  lineStart: number; // 1-based, the heading's own line
}

interface EntryDraft {
  id: string;
  group: string;
  title: string;
  bodyStartLine: number; // 1-based, inclusive
  bodyEndLine: number; // 1-based, inclusive
  commands: string[];
  gotchas: string[];
  parentH2Index: number | null;
}

function collectBoundaries(root: Root): Boundary[] {
  const boundaries: Boundary[] = [];
  for (const node of root.children) {
    if (node.type !== "heading") continue;
    const h = node as Heading;
    if ((h.depth === 2 || h.depth === 3) && h.position) {
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
  let currentGroup: string | null = null;
  let currentH2Index: number | null = null;

  boundaries.forEach((b, i) => {
    const nextLineStart = boundaries[i + 1]?.lineStart;
    const bodyStartLine = b.lineStart + 1;
    const bodyEndLine = (nextLineStart ?? lines.length + 1) - 1;

    if (b.depth === 2) {
      if (!STEP_HEADING_RE.test(b.title)) {
        currentGroup = null;
        currentH2Index = null;
        return;
      }
      currentGroup = b.title;
      entries.push({
        id: nextId.take(),
        group: b.title,
        title: b.title,
        bodyStartLine,
        bodyEndLine,
        commands: [],
        gotchas: [],
        parentH2Index: null,
      });
      currentH2Index = entries.length - 1;
      return;
    }

    // H3
    if (currentGroup === null) return; // an H3 outside any recognized "## Step" group — ignore
    entries.push({
      id: nextId.take(),
      group: currentGroup,
      title: b.title,
      bodyStartLine,
      bodyEndLine,
      commands: [],
      gotchas: [],
      parentH2Index: currentH2Index,
    });
    if (GOTCHA_RE.test(b.title) && currentH2Index !== null) {
      entries[currentH2Index]!.gotchas.push(b.title);
    }
  });

  const entryFor = (line: number): EntryDraft | undefined =>
    entries.find((e) => line >= e.bodyStartLine && line <= e.bodyEndLine);

  visit(root, "code", (node: Code) => {
    if (!node.lang || !node.position) return;
    const entry = entryFor(node.position.start.line);
    if (entry) entry.commands.push(node.value);
  });

  visit(root, "paragraph", (node: Paragraph) => {
    if (!node.position) return;
    const text = flattenText(node);
    if (!GOTCHA_RE.test(text)) return;
    const entry = entryFor(node.position.start.line);
    if (entry) entry.gotchas.push(text);
  });

  return entries.map((e) => ({
    id: e.id,
    group: e.group,
    title: e.title,
    body: lines.slice(e.bodyStartLine - 1, e.bodyEndLine).join("\n").trim(),
    commands: e.commands,
    gotchas: e.gotchas,
  }));
}
