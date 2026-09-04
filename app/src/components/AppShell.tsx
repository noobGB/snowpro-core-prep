/**
 * Page shell: sidebar + content area on desktop, a top bar + fixed bottom nav under 900px (spec
 * §6: "mobile is 390px with the sidebar collapsed to a bottom bar of five items"). Both chrome
 * sets are always rendered; `.desktop-only`/`.mobile-only` (tokens.css) toggle via media query.
 */

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { ConflictBanner } from "./ConflictBanner";
import { GuestBanner } from "./GuestBanner";
import { openSettings } from "../lib/settingsStore";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
      <ConflictBanner />
      <MobileTopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div className="desktop-only">
          <Sidebar />
        </div>
        {/* margin: "0 auto" matters once the viewport is wide enough for maxWidth to actually
            clamp this element -- without it, flex:1 fills the remaining space up to the cap but
            stays left-aligned next to the sidebar, leaving a large dead zone on the right at
            ultrawide widths instead of centering the content column. */}
        <main className="app-main" style={{ flex: 1, minWidth: 0, padding: "32px 40px 96px", maxWidth: 1180, margin: "0 auto" }}>
          {/* Inside <main>, not up beside ConflictBanner: this needs to sit within the content
              column so it lines up with the page rather than spanning under the sidebar. It still
              inherits the property that matters -- Runner bypasses AppShell entirely, so a guest
              never sees this during an exam. Renders null for a normal account. */}
          {/* Wrapped, not passed by reference: openSettings takes an intent, and onClick would
              hand it the MouseEvent instead -- which isn't a type error (an optional param is
              assignable to () => void) but silently opens Settings in "default" intent, leaving
              the conversion form collapsed. That defeats the entire point of this CTA. */}
          <GuestBanner onCreateAccount={() => openSettings("upgrade")} />
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
