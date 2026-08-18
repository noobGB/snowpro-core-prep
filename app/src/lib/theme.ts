/**
 * Theme resolution + application for light/dark/system mode (spec follow-up, issue #34). Kept
 * separate from progress.ts (which only owns *storing* the preference) since this module is the
 * one place that touches the DOM — everything else stays pure and testable.
 */

export type Theme = "dark" | "light" | "system";

/** Maps a stored preference to the `data-theme` attribute value tokens.css keys off, or
 *  `undefined` for "system" — meaning "don't set the attribute at all," which lets the
 *  `prefers-color-scheme` media query in tokens.css decide instead. */
export function resolveThemeAttribute(theme: Theme): "light" | "dark" | undefined {
  if (theme === "system") return undefined;
  return theme;
}

/** Sets (or removes) `data-theme` on the root element. This is the only place in the app that
 *  writes this attribute — call it from a root-level effect whenever `settings.theme` changes. */
export function applyTheme(theme: Theme): void {
  const resolved = resolveThemeAttribute(theme);
  if (resolved) {
    document.documentElement.dataset.theme = resolved;
  } else {
    delete document.documentElement.dataset.theme;
  }
}
