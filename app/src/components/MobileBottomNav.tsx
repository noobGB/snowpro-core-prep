/**
 * Narrow-viewport bottom nav — four direct tabs (Home, Notes, Practice, Drill: the destinations
 * touched several times a day) plus a fifth "More" tab, the standard 5-tab-plus-overflow mobile
 * pattern. Everything else (Study plan, Mock exams, Analytics, Resources, Setup, and the Settings
 * modal, none of which have a mobile entry point otherwise) lives behind that tab in
 * MobileMoreSheet.
 */

import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MobileMoreSheet } from "./MobileMoreSheet";

const ITEMS = [
  { label: "Home", to: "/" },
  { label: "Notes", to: "/notes/d1" },
  { label: "Practice", to: "/practice" },
  { label: "Drill", to: "/drill" },
];

const MORE_ROUTES = ["/plan", "/mocks", "/analytics", "/resources", "/setup", "/admin"];

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const moreActive = MORE_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <>
      <nav
        className="mobile-only"
        style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 60, background: "var(--card)", borderTop: "1px solid var(--hairline)", zIndex: 30 }}
      >
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              style={({ isActive }) => ({
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontSize: 11,
                minHeight: 44,
                color: isActive ? "var(--text-heading)" : "var(--text-dim)",
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: isActive ? "var(--accent)" : "transparent" }} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            style={{
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
              color: moreActive ? "var(--text-heading)" : "var(--text-dim)",
              cursor: "pointer",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: moreActive ? "var(--accent)" : "transparent" }} />
            <span>More</span>
          </button>
        </div>
      </nav>
      {moreOpen && <MobileMoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}
