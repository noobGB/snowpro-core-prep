/**
 * Builds search-index.json from the fully assembled bundle (never a second markdown pass, so
 * it's guaranteed consistent with what's actually written). Spec only requires substring match
 * for v1, so this is a flat array, not a real search engine. Note-body text is indexed one entry
 * per section (its rendered HTML stripped of tags), not split per paragraph — a coarser grain
 * than the ideal, but sufficient for substring matching and avoids a second text-capture pass
 * through domainNotes.ts purely for indexing.
 */

import type { ContentBundle, DomainNotes, SearchIndexEntry } from "../types.js";

const PAGE_NAMES = [
  "Dashboard",
  "Notes",
  "Practice",
  "Mock Exams",
  "Flashcards",
  "Study Plan",
  "Resources",
  "Setup",
  "Analytics",
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildSearchIndex(
  bundle: ContentBundle,
  notesByDomain: Map<string, DomainNotes>,
): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = [];

  for (const name of PAGE_NAMES) {
    entries.push({ type: "page", text: name, refId: name });
  }

  for (const domain of bundle.domains) {
    entries.push({ type: "domain", text: domain.title, domainId: domain.id, refId: domain.id });
    for (const section of domain.sections) {
      entries.push({
        type: "heading",
        text: section.title,
        domainId: domain.id,
        refId: `${domain.id}#${section.anchor}`,
      });
    }
  }

  for (const notes of notesByDomain.values()) {
    for (const section of notes.sections) {
      const text = stripHtml(section.html);
      if (!text) continue;
      entries.push({
        type: "paragraph",
        text,
        domainId: notes.domainId,
        refId: `${notes.domainId}#${section.anchor}`,
      });
    }
  }

  for (const question of bundle.questions) {
    entries.push({ type: "question", text: question.stem, domainId: question.domainId, refId: question.id });
  }

  return entries;
}
