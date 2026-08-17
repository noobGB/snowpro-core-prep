/**
 * Human-readable console output for a pipeline run: skip notices (always), then either the
 * success summary or the grouped failure report.
 */

import type { ErrorCollector } from "./errors.js";
import type { ContentBundle } from "./types.js";

export interface RunStats {
  domainQuestions: number;
  mockDedupedReused: number;
  mockNewlyTagged: number;
  mockTotal: number;
}

export function printNotices(notices: string[]): void {
  for (const notice of notices) console.log(`  · ${notice}`);
}

export function printSuccess(bundle: ContentBundle, stats: RunStats, outputDir: string): void {
  const totalWeight = bundle.domains.reduce((sum, d) => sum + d.weight, 0);
  console.log("✓ Content pipeline complete");
  console.log(`  bankVersion: ${bundle.bankVersion}`);
  console.log(`  domains: ${bundle.domains.length} (weights sum ${totalWeight.toFixed(2)})`);
  console.log(
    `  questions: ${bundle.questions.length} (${stats.domainQuestions} domain-authored, ${stats.mockNewlyTagged} mock-only-tagged; mock set has ${stats.mockTotal} total, ${stats.mockDedupedReused} reused via dedup)`,
  );
  console.log(`  sets: ${bundle.sets.length}`);
  console.log(`  flashcards: ${bundle.flashcards.length}`);
  console.log(`  plan days: ${bundle.plan.length}`);
  console.log(`  resources: ${bundle.resources.length}`);
  console.log(`  setup steps: ${bundle.setup.length}`);
  console.log(`  written to: ${outputDir}`);
}

export function printFailure(collector: ErrorCollector): void {
  const grouped = collector.groupedByFile();
  const total = collector.all.length;
  console.error(`\n✗ Content pipeline failed — ${total} error(s) across ${grouped.length} file(s). Nothing written.\n`);
  for (const { file, errors } of grouped) {
    console.error(file);
    for (const e of errors) {
      const loc = e.line ? ` (line ${e.line})` : "";
      console.error(`  [${e.kind}] ${e.itemRef}${loc}: ${e.message}`);
    }
    console.error("");
  }
}
