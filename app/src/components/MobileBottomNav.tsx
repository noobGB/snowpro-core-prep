/** Narrow-viewport bottom nav — five items per the wireframes' mobileNav (Home, Notes, Practice,
 *  Drill, Plan), each a 44px+ touch target with a small active-state dot. */

import { NavLink } from "react-router-dom";

const ITEMS = [
  { label: "Home", to: "/" },
  { label: "Notes", to: "/notes/d1" },
  { label: "Practice", to: "/practice" },
  { label: "Drill", to: "/drill" },
  { label: "Plan", to: "/plan" },
];

export function MobileBottomNav() {
  return (
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
      </div>
    </nav>
  );
}
