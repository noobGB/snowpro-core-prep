/**
 * Id builders for every id-bearing record the pipeline emits. Kept centralized so the id format
 * for each record kind is defined exactly once.
 */

export function domainId(domainNumber: number): string {
  return `d${domainNumber}`;
}

/** "<domainId>-q<n>" for a question authored in that domain's own practice-question file. */
export function domainQuestionId(domain: string, sourceIndex: number): string {
  return `${domain}-q${sourceIndex}`;
}

/** "mock<fileNum>-q<n>" for a question authored directly in a mock file (no domain-file dedup
 *  match), tagged via an inline [Dx] marker. Kept in its own id space rather than splicing into
 *  the domain-file numbering, which would require renumbering already-assigned ids. */
export function mockOnlyQuestionId(mockFileNumber: number, sourceIndex: number): string {
  return `mock${mockFileNumber}-q${sourceIndex}`;
}

export function domainSetId(domain: string): string {
  return `set-${domain}`;
}

export function mockSetId(mockFileNumber: number): string {
  return `mock-${mockFileNumber}`;
}

/** Literal "N.M" for a numbered H2, or "parentId.position" for an unnumbered H3 (positional,
 *  not semantic — see plan's "Section-id scheme"). */
export function sectionId(parentH2Id: string | null, numberedId: string | null, position: number): string {
  if (numberedId) return numberedId;
  if (parentH2Id) return `${parentH2Id}.${position}`;
  return String(position);
}

/** Simple monotonically-increasing counter for id kinds assigned purely by document order
 *  (flashcards, setup steps). */
export class SequentialId {
  private next = 1;
  constructor(private readonly prefix: string) {}
  take(): string {
    return `${this.prefix}${this.next++}`;
  }
}
