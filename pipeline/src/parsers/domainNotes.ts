/**
 * Parses one domain-notes file (01-05) into a Domain record, its flat sections[] (used for the
 * content.json TOC / "quiz me on this section" hooks), and the richer notes/<domainId>.json
 * (one HTML-rendered entry per H2, with any nested H3 content folded into the same blob).
 *
 * H1 = "# Domain N — Title (NN%)". H2s use a stable "N.M Title" numbering in every file except
 * the terminal "## Self-check before moving on", which has no number and falls back to a
 * slug-based id. One file (03) nests three unnumbered H3s under its first H2 — those get a
 * positional id ("3.1.1", "3.1.2", ...) since there's no numbering scheme for them in the source.
 * Every file opens with a short intro paragraph between the H1 and the first H2 (confirmed on
 * disk) — preserved as a synthetic "intro" section rather than dropped.
 */

import type { Heading, Root, RootContent } from "mdast";
import type { ErrorCollector } from "../errors.js";
import type { Domain, DomainNotes, NoteSection } from "../types.js";
import { domainId } from "../util/ids.js";
import { headingText, nodesToHtml, parseMd } from "../util/markdown.js";
import { slugify } from "../util/slugify.js";

const H1_RE = /^Domain (\d+) — (.+?) \((\d+)%\)$/;
const H2_NUMBERED_RE = /^(\d+)\.(\d+)\s+(.+)$/;

interface SectionAccumulator {
  id: string;
  title: string;
  anchor: string;
  nodes: RootContent[];
}

export interface DomainNoteResult {
  domain: Domain;
  notes: DomainNotes;
}

export function parseDomainNotes(
  raw: string,
  filename: string,
  collector: ErrorCollector,
): DomainNoteResult | null {
  const root = parseMd(raw);
  const children = root.children;
  const h1 = children[0];

  if (!h1 || h1.type !== "heading" || (h1 as Heading).depth !== 1) {
    collector.add({
      file: filename,
      itemRef: "H1",
      kind: "parse-error",
      message: `expected the file to start with an H1, found: ${h1?.type ?? "nothing"}`,
    });
    return null;
  }

  const h1Text = headingText(h1 as Heading);
  const h1Match = h1Text.match(H1_RE);
  if (!h1Match) {
    collector.add({
      file: filename,
      itemRef: "H1",
      kind: "parse-error",
      message: `expected "Domain N — Title (NN%)", got: ${JSON.stringify(h1Text)}`,
    });
    return null;
  }

  const [, numberStr, title, weightStr] = h1Match;
  const number = Number(numberStr);
  const weight = Number(weightStr) / 100;
  const domain = domainId(number);

  const sections: SectionAccumulator[] = [];
  let currentH2Id: string | null = null;
  let h3Counter = 0;
  const flatSections: NoteSection[] = [];

  function newSection(id: string, sectionTitle: string): SectionAccumulator {
    const anchor = slugify(sectionTitle);
    flatSections.push({ id, title: sectionTitle, anchor });
    return { id, title: sectionTitle, anchor, nodes: [] };
  }

  // Content between the H1 and the first H2 is real (a short verification/intro paragraph in
  // every file) — preserved as a synthetic leading section rather than dropped.
  let current: SectionAccumulator = newSection("intro", "Overview");

  for (let i = 1; i < children.length; i++) {
    const node = children[i]!;

    if (node.type === "heading" && (node as Heading).depth === 2) {
      const text = headingText(node as Heading);
      const numbered = text.match(H2_NUMBERED_RE);
      const id = numbered ? `${numbered[1]}.${numbered[2]}` : slugify(text);
      const sectionTitle = numbered ? (numbered[3] ?? text) : text;
      currentH2Id = id;
      h3Counter = 0;
      sections.push(current);
      current = newSection(id, sectionTitle);
      continue;
    }

    if (node.type === "heading" && (node as Heading).depth === 3 && currentH2Id) {
      h3Counter += 1;
      const text = headingText(node as Heading);
      const id = `${currentH2Id}.${h3Counter}`;
      flatSections.push({ id, title: text, anchor: slugify(text) });
      // H3 content still flows into the current (H2) section's HTML blob — not flushed here.
      current.nodes.push(node);
      continue;
    }

    current.nodes.push(node);
  }
  sections.push(current);

  // Drop the synthetic "intro" section from the flat TOC list if the file had no real intro
  // content — an empty section is not useful to navigate to.
  const introIsEmpty = sections[0]?.id === "intro" && sections[0].nodes.length === 0;
  const flatSectionsFinal = introIsEmpty ? flatSections.filter((s) => s.id !== "intro") : flatSections;
  const sectionsFinal = introIsEmpty ? sections.filter((s) => s.id !== "intro") : sections;

  return {
    domain: {
      id: domain,
      number,
      title: title ?? "",
      weight,
      noteFile: filename,
      sections: flatSectionsFinal,
    },
    notes: {
      domainId: domain,
      sections: sectionsFinal.map((s) => ({
        id: s.id,
        title: s.title,
        anchor: s.anchor,
        html: nodesToHtml(s.nodes),
      })),
    },
  };
}
