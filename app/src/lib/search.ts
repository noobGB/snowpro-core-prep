/**
 * Loader for search-index.json, built once by the content pipeline (spec §6.12: "substring
 * match over the prebuilt index; no fuzzy scoring in v1").
 */

export type SearchEntryType = "page" | "domain" | "heading" | "paragraph" | "question";

export interface SearchIndexEntry {
  type: SearchEntryType;
  text: string;
  domainId?: string;
  refId: string;
}

let cached: Promise<SearchIndexEntry[]> | null = null;

export function loadSearchIndex(): Promise<SearchIndexEntry[]> {
  if (!cached) {
    cached = fetch("/search-index.json").then((res) => {
      if (!res.ok) throw new Error(`search-index.json fetch failed: ${res.status}`);
      return res.json() as Promise<SearchIndexEntry[]>;
    });
  }
  return cached;
}
