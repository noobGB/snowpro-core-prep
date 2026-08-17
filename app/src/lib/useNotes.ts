import { useEffect, useState } from "react";
import { loadNotes, type DomainNotes } from "./content";

export interface UseNotesResult {
  notes: DomainNotes | null;
  error: Error | null;
}

/** Loads notes/<domainId>.json, re-fetching whenever domainId changes. */
export function useNotes(domainId: string | undefined): UseNotesResult {
  const [notes, setNotes] = useState<DomainNotes | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!domainId) return;
    let cancelled = false;
    setNotes(null);
    setError(null);
    loadNotes(domainId)
      .then((data) => {
        if (!cancelled) setNotes(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [domainId]);

  return { notes, error };
}
