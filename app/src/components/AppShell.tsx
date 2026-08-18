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

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
      <ConflictBanner />
      <MobileTopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div className="desktop-only">
          <Sidebar />
        </div>
        {/* `margin: "0 auto"` centers this box within whatever space is left after the sidebar,
            once `flex: 1` growth is stopped by `maxWidth`. Without it, that leftover space just
            sits unclaimed to the right — invisible on a normal laptop screen where 1180px is most
            of the viewport, but a wall of dead canvas on a wide monitor (e.g. ~1440px of nothing
            at a 2858px viewport, confirmed via screenshot) that every page inherited silently. */}
        <main className="app-main" style={{ flex: 1, minWidth: 0, padding: "32px 40px 96px", maxWidth: 1180, margin: "0 auto" }}>
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
