/**
 * Narrow-viewport bottom nav — four direct tabs plus a fifth "More" tab, the standard 5-tab-plus-
 * overflow mobile pattern (kept over a hamburger/drawer per a UX pass: a top-left hamburger sits in
 * the worst one-handed thumb-reach zone on a phone, and a drawer would just duplicate what
 * MobileMoreSheet already does with worse ergonomics for these highest-frequency actions).
 *
 * Direct tabs are Home, Mock exams, Settings (opens the shared settings modal, not a route), and
 * Notes — except in an admin session, where Notes moves into the More sheet and Admin takes the
 * fourth slot instead, matching Sidebar.tsx/MobileMoreSheet.tsx's existing "server-side
 * requireAdmin is the real gate, this is just UX" convention. Everything else lives behind More.
 */

import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { closePalette } from "../lib/paletteStore";
import { openSettings, useSettingsOpen } from "../lib/settingsStore";
import { useSessionUser } from "../lib/session";

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  fontSize: 11,
  minHeight: 44,
  background: "transparent",
  border: "none",
  color: active ? "var(--text-heading)" : "var(--text-dim)",
  cursor: "pointer",
});

const dotStyle = (active: boolean): React.CSSProperties => ({
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: active ? "var(--accent)" : "transparent",
});

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const sessionUser = useSessionUser();
  const settingsOpen = useSettingsOpen();
  const isAdmin = sessionUser?.role === "admin";

  const fourthItem = isAdmin ? { label: "Admin", to: "/admin" } : { label: "Notes", to: "/notes/d1" };

  const moreRoutes = ["/practice", "/drill", "/plan", "/analytics", "/resources", "/setup"];
  if (isAdmin) moreRoutes.push("/notes");
  const moreActive = moreRoutes.some((r) => location.pathname.startsWith(r));

  return (
    <>
      <nav
        className="mobile-only"
        style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "var(--card)", borderTop: "1px solid var(--hairline)", zIndex: 30 }}
      >
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          <NavLink to="/" end style={({ isActive }) => tabStyle(isActive)}>
            {({ isActive }) => (
              <>
                <span style={dotStyle(isActive)} />
                <span>Home</span>
              </>
            )}
          </NavLink>
          <NavLink to="/mocks" style={({ isActive }) => tabStyle(isActive)}>
            {({ isActive }) => (
              <>
                <span style={dotStyle(isActive)} />
                <span>Mock exams</span>
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={() => {
              closePalette();
              openSettings();
            }}
            style={tabStyle(settingsOpen)}
          >
            <span style={dotStyle(settingsOpen)} />
            <span>Settings</span>
          </button>
          <NavLink to={fourthItem.to} style={({ isActive }) => tabStyle(isActive)}>
            {({ isActive }) => (
              <>
                <span style={dotStyle(isActive)} />
                <span>{fourthItem.label}</span>
              </>
            )}
          </NavLink>
          <button type="button" onClick={() => setMoreOpen(true)} style={tabStyle(moreActive)}>
            <span style={dotStyle(moreActive)} />
            <span>More</span>
          </button>
        </div>
      </nav>
      {moreOpen && <MobileMoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}
