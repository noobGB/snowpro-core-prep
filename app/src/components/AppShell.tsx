/**
 * Page shell: sidebar + content area on desktop, a top bar + fixed bottom nav under 900px (spec
 * §6: "mobile is 390px with the sidebar collapsed to a bottom bar of five items"). Both chrome
 * sets are always rendered; `.desktop-only`/`.mobile-only` (tokens.css) toggle via media query.
 */

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
      <MobileTopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div className="desktop-only">
          <Sidebar />
        </div>
        <main className="app-main" style={{ flex: 1, minWidth: 0, padding: "32px 40px 96px", maxWidth: 1180 }}>
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
