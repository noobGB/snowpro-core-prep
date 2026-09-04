/**
 * Tiny external store for the Settings panel's open/closed state, mirroring paletteStore.ts's
 * pattern exactly — the panel is mounted once at the App root (see CommandPalette's own doc
 * comment for why) rather than owned by whichever nav component happens to render the trigger
 * button, so a future second trigger (e.g. a mobile nav entry point) can open the same instance
 * without duplicating state.
 */

import { useSyncExternalStore } from "react";

/** Why the panel was opened, so it can open on the right thing rather than a generic menu.
 *  - "default": the Settings nav button — the panel opens as it always has.
 *  - "upgrade": a guest conversion CTA (GuestBanner, MockExams' gate). The Account section opens
 *    with the create-an-account form already expanded and focused, because the user already
 *    stated that intent by clicking; making them find and click a second "Create a free account"
 *    inside the panel is a dead step in the single flow this launch depends on. */
export type SettingsIntent = "default" | "upgrade";

let open = false;
let intent: SettingsIntent = "default";
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** `nextIntent` is normalized rather than trusted so that a stray `onClick={openSettings}` (React
 *  would hand it a MouseEvent) can only ever fall back to "default", never smuggle an object in. */
export function openSettings(nextIntent: SettingsIntent = "default"): void {
  intent = nextIntent === "upgrade" ? "upgrade" : "default";
  open = true;
  emit();
}

export function closeSettings(): void {
  open = false;
  // Deliberately reset on close, not on open: an "upgrade" open that the user dismisses must not
  // silently re-arm the expanded form the next time they click plain Settings.
  intent = "default";
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettingsOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open);
}

export function useSettingsIntent(): SettingsIntent {
  return useSyncExternalStore(subscribe, () => intent, () => intent);
}

/** Test-only reset — the store is module-level singleton state, so one spec's open() would
 *  otherwise leak into the next. Not used by the app itself. */
export function resetSettingsStoreForTests(): void {
  open = false;
  intent = "default";
}
