/**
 * Types and loader for content.json, served at the site root by Vite's publicDir (see
 * vite.config.ts) from the content pipeline's output. These types mirror
 * pipeline/src/types.ts — duplicated for now since app/ and pipeline/ aren't set up as npm
 * workspaces yet; keep them in sync by hand until that's worth doing.
 */

export type QuestionType = "single" | "multi";

export type MockDifficulty = "easy" | "medium" | "hard";

export interface QuestionOption {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  domainId: string;
  section?: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  correct: string[];
  explanation: string;
  sourceFile: string;
  sourceIndex: number;
}

export interface NoteSection {
  id: string;
  title: string;
  anchor: string;
}

export interface Domain {
  id: string;
  number: number;
  title: string;
  weight: number;
  noteFile: string;
  sections: NoteSection[];
}

export interface QuestionSet {
  id: string;
  kind: "domain" | "mock";
  domainId?: string;
  title: string;
  questionIds: string[];
  timed: boolean;
  durationMin?: number;
  domainSplit?: Record<string, number>;
  difficulty?: MockDifficulty;
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
  priority: "must" | "skippable";
  role?: "pin-early" | "mock1" | "mock2" | "review";
}

export interface PlanDay {
  date: string;
  label: string;
  tasks: PlanTask[];
}

export interface Resource {
  domainId: string | null;
  title: string;
  url: string | null;
  official: boolean;
}

export interface SetupItem {
  id: string;
  kind: "step" | "issue";
  group: string;
  title: string;
  summary: string;
  commands: string[];
  sourceAnchor: string;
}

export interface ContentBundle {
  bankVersion: string;
  generatedAt: string;
  generatedFrom: string[];
  domains: Domain[];
  questions: Question[];
  sets: QuestionSet[];
  flashcards: Flashcard[];
  plan: PlanDay[];
  resources: Resource[];
  setup: SetupItem[];
}

export interface DomainNotes {
  domainId: string;
  sections: Array<NoteSection & { html: string }>;
}

let cached: Promise<ContentBundle> | null = null;

/** Fetches content.json once per page load and caches the in-flight/resolved promise. */
export function loadContent(): Promise<ContentBundle> {
  if (!cached) {
    cached = fetch("/content.json").then((res) => {
      if (!res.ok) throw new Error(`content.json fetch failed: ${res.status}`);
      return res.json() as Promise<ContentBundle>;
    });
  }
  return cached;
}

const notesCache = new Map<string, Promise<DomainNotes>>();

/** Fetches notes/<domainId>.json once per domain per page load — the notes reader is the only
 *  screen that needs this, so it stays out of the eagerly-loaded content.json. */
export function loadNotes(domainId: string): Promise<DomainNotes> {
  let entry = notesCache.get(domainId);
  if (!entry) {
    entry = fetch(`/notes/${domainId}.json`).then((res) => {
      if (!res.ok) throw new Error(`notes/${domainId}.json fetch failed: ${res.status}`);
      return res.json() as Promise<DomainNotes>;
    });
    notesCache.set(domainId, entry);
  }
  return entry;
}
