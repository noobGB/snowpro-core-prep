/**
 * Tiny external store for the ⌘K palette's open/closed state — needed because the trigger button
 * lives in Sidebar while the palette itself is mounted once at the App root (so its global ⌘K
 * keyboard listener works even on routes without a sidebar, like the session runner).
 */

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function openPalette(): void {
  open = true;
  emit();
}

export function closePalette(): void {
  open = false;
  emit();
}

export function togglePalette(): void {
  open = !open;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePaletteOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open);
}
