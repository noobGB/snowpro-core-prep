import { useEffect, useState } from "react";
import { loadContent, type ContentBundle } from "./content";

export interface UseContentResult {
  content: ContentBundle | null;
  error: Error | null;
}

/** Loads content.json once and re-renders the caller when it resolves. */
export function useContent(): UseContentResult {
  const [content, setContent] = useState<ContentBundle | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadContent()
      .then((data) => {
        if (!cancelled) setContent(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { content, error };
}
