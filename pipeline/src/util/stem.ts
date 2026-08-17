/**
 * Normalizes a question stem for dedup matching between domain-file questions and mock-exam
 * questions (mockExam.ts). Confirmed on the real files: 50 of the mock's 100 questions are
 * byte-for-byte verbatim duplicates of domain-file questions, so an exact match after this
 * normalization is the expected common case, not a fuzzy heuristic.
 */
export function normalizeStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, "") // strip inline markdown emphasis/code markers first
    .replace(/[^\p{L}\p{N}\s]/gu, "") // strip punctuation (unicode-aware)
    .replace(/\s+/g, " ")
    .trim();
}
