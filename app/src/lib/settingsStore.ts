/**
 * Tiny external store for the Settings panel's open/closed state, mirroring paletteStore.ts's
 * pattern exactly — the panel is mounted once at the App root (see CommandPalette's own doc
 * comment for why) rather than owned by whichever nav component happens to render the trigger
 * button, so a future second trigger (e.g. a mobile nav entry point) can open the same instance
 * without duplicating state.
 */

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function openSettings(): void {
  open = true;
  emit();
}

export function closeSettings(): void {
  open = false;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettingsOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open);
}
