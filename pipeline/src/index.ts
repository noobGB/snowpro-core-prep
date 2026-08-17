/**
 * Content pipeline core + CLI entry point: reads the SnowPro Core Prep markdown study folder and
 * produces content.json + notes/<domainId>.json + search-index.json. See the plan file
 * ("SnowPro Core Prep — Content Pipeline") for the full design; this module wires each parser
 * together in the order spec §5 implies (notes and domain-authored questions first, since the
 * mock exam's dedup pass depends on them).
 *
 * `runPipeline()` is the reusable core — parse, assemble, validate, but never write or print.
 * `main()` is the CLI wrapper (resolve config, run, print, write on success). The container
 * server (server.ts) calls `runPipeline()` directly at boot instead of spawning this as a
 * subprocess, so both entry points share one implementation and can never drift.
 *
 * Nothing is written until every stage — parsing and post-assembly validation alike — has run
 * against one shared ErrorCollector. If it's non-empty for any reason, the run reports the full
 * grouped failure and nothing is written at all.
 */

import { pathToFileURL } from "node:url";
import { resolveConfig, type PipelineConfig } from "./config.js";
import { classifyFiles } from "./discovery.js";
import { ErrorCollector } from "./errors.js";
import { listMarkdownFiles, readSourceFile } from "./util/fs.js";
import { computeBankVersion } from "./util/hash.js";
import { buildDomainSets, buildMockSet } from "./assemble/sets.js";
import { buildSearchIndex } from "./assemble/searchIndex.js";
import { validateBundle } from "./assemble/validate.js";
import { parseDomainNotes } from "./parsers/domainNotes.js";
import { parsePracticeQuestions } from "./parsers/practiceQuestions.js";
import { parseMockExam, parseMockMeta } from "./parsers/mockExam.js";
import { parseCheatsheet } from "./parsers/cheatsheet.js";
import { parseStudyPlan } from "./parsers/studyPlan.js";
import { parseResources } from "./parsers/resources.js";
import { parseSetupLog } from "./parsers/setupLog.js";
import { writeOutput } from "./write/output.js";
import { printFailure, printNotices, printSuccess, type RunStats } from "./report.js";
import type { ContentBundle, Domain, DomainNotes, Question, SearchIndexEntry } from "./types.js";

export interface PipelineResult {
  success: boolean;
  bundle?: ContentBundle;
  notesByDomain?: Map<string, DomainNotes>;
  searchIndex?: SearchIndexEntry[];
  stats?: RunStats;
  notices: string[];
  collector: ErrorCollector;
}

export function runPipeline(config: PipelineConfig): PipelineResult {
  const collector = new ErrorCollector();
  const notices: string[] = [];

  const filenames = listMarkdownFiles(config.sourceDir);
  const { classified, skipped } = classifyFiles(filenames);
  for (const filename of skipped) {
    notices.push(`skipped (unrecognized filename pattern): ${filename}`);
  }

  const sourceFiles = classified.map((f) => readSourceFile(config.sourceDir, f.filename));
  const bankVersion = computeBankVersion(sourceFiles);
  const rawByFilename = new Map(sourceFiles.map((f) => [f.filename, f.raw]));

  // --- Domain notes (01-05) ---
  const domains: Domain[] = [];
  const notesByDomain = new Map<string, DomainNotes>();
  for (const f of classified.filter((c) => c.kind === "domainNotes")) {
    const raw = rawByFilename.get(f.filename)!;
    const result = parseDomainNotes(raw, f.filename, collector);
    if (!result) continue;
    domains.push(result.domain);
    notesByDomain.set(result.domain.id, result.notes);
  }
  domains.sort((a, b) => a.number - b.number);

  // --- Practice questions (10-14) — domainId is unambiguous from the filename ---
  const domainQuestions: Question[] = [];
  for (const f of classified.filter((c) => c.kind === "practiceQuestions")) {
    const raw = rawByFilename.get(f.filename)!;
    domainQuestions.push(...parsePracticeQuestions(raw, f.filename, f.number!, collector));
  }

  // --- Mock exam(s) — dedup against domainQuestions, resolve the rest via inline [Dx] tags ---
  const mockOnlyQuestions: Question[] = [];
  const mockSets = [];
  const statedMockSplits = new Map<string, Record<string, number>>();
  let mockDedupedReused = 0;
  let mockNewlyTagged = 0;
  for (const f of classified.filter((c) => c.kind === "mockExam")) {
    const raw = rawByFilename.get(f.filename)!;
    const mockFileNumber = f.number!;
    const meta = parseMockMeta(raw, mockFileNumber);
    const result = parseMockExam(raw, f.filename, mockFileNumber, domainQuestions, collector);

    mockOnlyQuestions.push(...result.newQuestions);
    mockNewlyTagged += result.newQuestions.length;
    mockDedupedReused += Math.max(0, result.questionIdsInOrder.length - result.newQuestions.length);

    if (meta.statedDomainSplit) {
      statedMockSplits.set(`mock-${mockFileNumber}`, meta.statedDomainSplit);
    }

    const allQuestionsSoFar = [...domainQuestions, ...mockOnlyQuestions];
    mockSets.push(
      buildMockSet(
        { mockFileNumber, title: meta.title, durationMin: meta.durationMin, questionIdsInOrder: result.questionIdsInOrder },
        allQuestionsSoFar,
      ),
    );
  }

  const allQuestions = [...domainQuestions, ...mockOnlyQuestions];

  // --- Cheatsheet, study plan, resources, setup log ---
  const cheatsheetFile = classified.find((c) => c.kind === "cheatsheet");
  const flashcards = cheatsheetFile ? parseCheatsheet(rawByFilename.get(cheatsheetFile.filename)!) : [];

  const studyPlanFile = classified.find((c) => c.kind === "studyPlan");
  const plan = studyPlanFile ? parseStudyPlan(rawByFilename.get(studyPlanFile.filename)!) : [];

  const resourcesFile = classified.find((c) => c.kind === "resources");
  const resourcesResult = resourcesFile
    ? parseResources(rawByFilename.get(resourcesFile.filename)!)
    : { resources: [], notices: [] };
  notices.push(...resourcesResult.notices);

  const setupLogFile = classified.find((c) => c.kind === "setupLog");
  const setup = setupLogFile ? parseSetupLog(rawByFilename.get(setupLogFile.filename)!) : [];

  // --- Assemble ---
  const domainSets = buildDomainSets(domains, allQuestions);
  const bundle: ContentBundle = {
    bankVersion,
    generatedAt: new Date().toISOString(),
    generatedFrom: classified.map((f) => f.filename).sort((a, b) => a.localeCompare(b)),
    domains,
    questions: allQuestions,
    sets: [...domainSets, ...mockSets],
    flashcards,
    plan,
    resources: resourcesResult.resources,
    setup,
  };

  const searchIndex = buildSearchIndex(bundle, notesByDomain);
  validateBundle(bundle, collector, { statedMockSplits });

  if (collector.hasErrors) {
    return { success: false, notices, collector };
  }

  return {
    success: true,
    bundle,
    notesByDomain,
    searchIndex,
    stats: {
      domainQuestions: domainQuestions.length,
      mockDedupedReused,
      mockNewlyTagged,
      mockTotal: mockSets.reduce((sum, s) => sum + s.questionIds.length, 0),
    },
    notices,
    collector,
  };
}

function main(): void {
  const config = resolveConfig();
  const result = runPipeline(config);
  printNotices(result.notices);

  if (!result.success) {
    printFailure(result.collector);
    process.exitCode = 1;
    return;
  }

  writeOutput(config.outputDir, result.bundle!, result.notesByDomain!, result.searchIndex!);
  printSuccess(result.bundle!, result.stats!, config.outputDir);
}

// Only auto-run when this file is executed directly (the CLI) — not when server.ts imports
// `runPipeline` from it, which would otherwise also trigger this CLI's own resolveConfig()/main()
// as an import-time side effect, racing the server's own explicit call.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
