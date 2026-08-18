/**
 * Structural invariant checks over the fully assembled bundle, run after every parser has
 * finished — cheap insurance against a parser bug silently producing structurally-broken output
 * even when individual files parsed "successfully." Feeds the same shared ErrorCollector as
 * every parse stage, so a validation failure and a parse failure show up in one unified report.
 */

import type { ErrorCollector } from "../errors.js";
import type { ContentBundle } from "../types.js";

export interface ValidateOptions {
  /** setId -> the domainSplit stated in that mock's own intro prose, for a free cross-check
   *  against a mistagging slip during the manual domain-tagging pass. */
  statedMockSplits?: Map<string, Record<string, number>>;
}

function checkUniqueIds(ids: string[], label: string, collector: ErrorCollector): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      collector.add({ file: "content.json", itemRef: id, kind: "parse-error", message: `duplicate id '${id}' in ${label}` });
    }
    seen.add(id);
  }
}

function sameCounts(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? 0) !== (b[key] ?? 0)) return false;
  }
  return true;
}

export function validateBundle(
  bundle: ContentBundle,
  collector: ErrorCollector,
  options: ValidateOptions = {},
): void {
  const questionIds = new Set(bundle.questions.map((q) => q.id));
  const domainIds = new Set(bundle.domains.map((d) => d.id));

  for (const set of bundle.sets) {
    for (const qid of set.questionIds) {
      if (!questionIds.has(qid)) {
        collector.add({
          file: "content.json",
          itemRef: set.id,
          kind: "parse-error",
          message: `set '${set.id}' references unknown question id '${qid}'`,
        });
      }
    }
    if (set.kind === "domain" && set.domainId && !domainIds.has(set.domainId)) {
      collector.add({
        file: "content.json",
        itemRef: set.id,
        kind: "parse-error",
        message: `set '${set.id}' has unknown domainId '${set.domainId}'`,
      });
    }
  }

  for (const q of bundle.questions) {
    if (!domainIds.has(q.domainId)) {
      collector.add({
        file: "content.json",
        itemRef: q.id,
        kind: "parse-error",
        message: `question '${q.id}' has unknown domainId '${q.domainId}'`,
      });
    }
  }
  for (const f of bundle.flashcards) {
    if (f.domainId && !domainIds.has(f.domainId)) {
      collector.add({
        file: "content.json",
        itemRef: f.id,
        kind: "parse-error",
        message: `flashcard '${f.id}' has unknown domainId '${f.domainId}'`,
      });
    }
  }
  for (const r of bundle.resources) {
    if (r.domainId && !domainIds.has(r.domainId)) {
      collector.add({
        file: "content.json",
        itemRef: r.title,
        kind: "parse-error",
        message: `resource '${r.title}' has unknown domainId '${r.domainId}'`,
      });
    }
  }

  checkUniqueIds(bundle.questions.map((q) => q.id), "questions", collector);
  checkUniqueIds(bundle.flashcards.map((f) => f.id), "flashcards", collector);
  checkUniqueIds(bundle.setup.map((s) => s.id), "setup", collector);
  checkUniqueIds(bundle.sets.map((s) => s.id), "sets", collector);

  // setupLog.ts requires a "> **Summary:** ..." blockquote immediately under every heading, but
  // can't enforce that itself (parseSetupLog has no ErrorCollector, matching every other leaf
  // parser in this codebase — see index.ts) -- so a missing/mislabeled blockquote silently leaves
  // `summary: ""` rather than failing the build, and the Setup page would render a card with a
  // title and nothing else. Catch that here instead, where the collector already is.
  for (const s of bundle.setup) {
    if (!s.summary.trim()) {
      collector.add({
        file: "15_Hands_On_Snowflake_Setup_Log.md",
        itemRef: s.id,
        kind: "parse-error",
        message: `setup item '${s.title}' has no "> **Summary:** ..." blockquote (or it isn't labeled exactly "Summary:") -- the Setup page would render this card with no content`,
      });
    }
  }

  const questionById = new Map(bundle.questions.map((q) => [q.id, q]));
  for (const set of bundle.sets) {
    if (set.kind !== "mock" || !set.domainSplit) continue;

    const recomputed: Record<string, number> = {};
    for (const qid of set.questionIds) {
      const domain = questionById.get(qid)?.domainId;
      if (!domain) continue;
      recomputed[domain] = (recomputed[domain] ?? 0) + 1;
    }
    if (!sameCounts(recomputed, set.domainSplit)) {
      collector.add({
        file: "content.json",
        itemRef: set.id,
        kind: "parse-error",
        message: `mock set '${set.id}' domainSplit mismatch: computed ${JSON.stringify(recomputed)}, stored ${JSON.stringify(set.domainSplit)}`,
      });
    }

    const stated = options.statedMockSplits?.get(set.id);
    if (stated && !sameCounts(recomputed, stated)) {
      collector.add({
        file: "content.json",
        itemRef: set.id,
        kind: "parse-error",
        message: `mock set '${set.id}' resolved domainSplit ${JSON.stringify(recomputed)} does not match the split stated in its own intro prose ${JSON.stringify(stated)} — a question may be mistagged`,
      });
    }
  }

  const totalWeight = bundle.domains.reduce((sum, d) => sum + d.weight, 0);
  if (Math.abs(totalWeight - 1) > 0.001) {
    collector.add({
      file: "content.json",
      itemRef: "domains",
      kind: "parse-error",
      message: `domain weights sum to ${totalWeight.toFixed(4)}, expected 1.0`,
    });
  }
}
