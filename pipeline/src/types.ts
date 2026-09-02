/**
 * Shared TypeScript types for the content pipeline, mirroring the data model in
 * "SnowPro Core Prep - Spec.dc.html" §4. `ContentBundle` is the in-memory shape that gets
 * validated and then split across content.json / notes/<domainId>.json / search-index.json
 * on write. A few fields are documented, additive extensions over the spec's literal example
 * (nullable `url`/`domainId` on Resource, `section` left optional on Question) — see the plan
 * for why each exists.
 */

export type QuestionType = "single" | "multi";

export type MockDifficulty = "easy" | "medium" | "hard";

export interface QuestionOption {
  key: string; // "A".."E"
  text: string;
}

export interface Question {
  id: string; // "<domainId>-q<n>" (authored in a domain file) or "mock<fileNum>-q<n>" (mock-only)
  domainId: string;
  /** Domain-note subsection id (e.g. "1.5") this question drills. Left undefined when the
   *  source has no data mapping the question to a subsection — see plan's "known content gap". */
  section?: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  correct: string[]; // option keys
  explanation: string;
  sourceFile: string;
  sourceIndex: number; // the question's own "**N.**" number within sourceFile
}

export interface NoteSection {
  id: string; // "N.M" for numbered H2s, "N.M.k" positional for unnumbered H3s
  title: string;
  anchor: string;
}

export interface Domain {
  id: string; // "d1".."d5"
  number: number;
  title: string;
  weight: number; // 0..1
  noteFile: string;
  sections: NoteSection[];
}

export interface QuestionSet {
  id: string;
  kind: "domain" | "mock";
  domainId?: string; // present for kind "domain"
  title: string;
  questionIds: string[];
  timed: boolean;
  durationMin?: number; // present for kind "mock"
  domainSplit?: Record<string, number>; // present for kind "mock"
  difficulty?: MockDifficulty; // present for kind "mock" -- editorial, see mockExam.ts's MOCK_DIFFICULTY
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  domainId: string | null;
  source: string;
}

export interface PlanTask {
  id: string;
  text: string;
  links: string[];
  /** Authored default tier, parsed from an optional trailing "{skip-ok}" tag on the source line
   *  (see studyPlan.ts) — "must" unless tagged. Crunch-mode compression (app/src/lib/planDates.ts)
   *  may still override this per-task at render time; this field is always the *authored* intent,
   *  never the effective one. */
  priority: "must" | "skippable";
  /** Structural tag for crunch-mode's hard invariants (mock ordering/gap, pinned registration),
   *  parsed from an optional trailing "{pin-early}"/"{mock:1}"/"{mock:2}"/"{review}" tag. Absent on
   *  ordinary tasks. Not for display -- never rendered to the user. */
  role?: "pin-early" | "mock1" | "mock2" | "review";
}

export interface PlanDay {
  /** Verbatim ISO date from the source file. Not pre-offset — see plan's "Study plan" section
   *  for the runtime remapping contract this leaves to the (not-yet-built) app. */
  date: string;
  label: string;
  tasks: PlanTask[];
}

export interface Resource {
  /** Nullable: exam-wide resources (not tied to one domain) have no domainId in the source. */
  domainId: string | null;
  title: string;
  /** Nullable: the "by domain" resource section lists course names with no URLs at all. */
  url: string | null;
  official: boolean;
}

export interface SetupItem {
  id: string; // "s-<n>", file-order position, never the parsed "Step N"/"Issue N" number
  kind: "step" | "issue"; // which top-level section ("## Setup Steps" / "## Known Issues & Fixes") this came from
  group: string; // owning heading's own text (itself, for a top-level entry; its parent's, for a sub-entry)
  title: string; // this heading's own text
  summary: string; // the "> **Summary:** ..." blockquote immediately under the heading
  commands: string[]; // language-tagged fenced code blocks in this entry's range
  sourceAnchor: string; // GitHub-slug of `title`, for a "full details" deep link back to the source file
}

export interface ContentBundle {
  bankVersion: string; // "sha256:<hex>" over sorted source file bytes
  generatedAt: string; // ISO timestamp, documentation only, not used for comparison
  generatedFrom: string[]; // discovered source filenames, sorted
  domains: Domain[];
  questions: Question[];
  sets: QuestionSet[];
  flashcards: Flashcard[];
  plan: PlanDay[];
  resources: Resource[];
  setup: SetupItem[];
}

/** notes/<domainId>.json — parsed heading tree + rendered HTML, loaded only by the notes reader. */
export interface DomainNotes {
  domainId: string;
  sections: Array<NoteSection & { html: string }>;
}

export type SearchIndexEntryType = "page" | "domain" | "heading" | "paragraph" | "question";

export interface SearchIndexEntry {
  type: SearchIndexEntryType;
  text: string;
  domainId?: string;
  refId: string;
}
