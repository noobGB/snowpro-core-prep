/**
 * Turns a heading's raw markdown text into a URL-safe anchor. Two edge cases drove this design,
 * both confirmed in the real domain-note files:
 *   - `### `COPY INTO` and error handling` (03_Domain3...) — code-span backticks and the emphasis
 *     markers around bold/italic text must be stripped BEFORE slugifying, or they leak into the
 *     anchor as stray characters.
 *   - `## 5.2 Snowflake's data sharing capabilities` (05_Domain5...) — apostrophes are removed
 *     outright (not replaced with a hyphen), so "Snowflake's" becomes "snowflakes", not
 *     "snowflake-s".
 */

/** Removes markdown emphasis/code-span syntax from heading text, keeping the inner content. */
export function stripMdSyntax(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1") // `code` -> code
    .replace(/\*\*([^*]*)\*\*/g, "$1") // **bold** -> bold
    .replace(/\*([^*]*)\*/g, "$1") // *italic* -> italic
    .replace(/_([^_]*)_/g, "$1"); // _italic_ -> italic
}

export function slugify(headingText: string): string {
  const stripped = stripMdSyntax(headingText);
  return stripped
    .toLowerCase()
    .replace(/'/g, "") // strip apostrophes without hyphenating
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
