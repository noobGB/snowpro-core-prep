/** Mac uses ⌘, every other platform uses Ctrl — checked once since it never changes mid-session. */
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent ?? "");

export const modKeyLabel = isMac ? "⌘K" : "Ctrl+K";
