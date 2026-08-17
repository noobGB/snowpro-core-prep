/**
 * Persistent 240px sidebar, per Nav.dc.html: nine flat destination links plus a search trigger
 * and settings icon at the foot. Active state is a raised fill with a 2px accent bar at the left
 * edge. Meta badges (domain/question/mock counts) come from content.json.
 */

import { NavLink } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { closePalette, openPalette } from "../lib/paletteStore";
import { closeSettings, openSettings } from "../lib/settingsStore";
import { modKeyLabel } from "../lib/platform";

interface NavItem {
  label: string;
  to: string;
  meta: string;
}

export function Sidebar() {
  const { content } = useContent();

  const domainAuthoredCount =
    content?.questions.filter((q) => /Practice_Questions/i.test(q.sourceFile)).length ?? null;
  const mockCount = content?.sets.filter((s) => s.kind === "mock").length ?? null;

  const items: NavItem[] = [
    { label: "Dashboard", to: "/", meta: "" },
    { label: "Notes", to: "/notes/d1", meta: content ? String(content.domains.length) : "" },
    { label: "Practice", to: "/practice", meta: domainAuthoredCount != null ? String(domainAuthoredCount) : "" },
    { label: "Mock exams", to: "/mocks", meta: mockCount != null ? String(mockCount) : "" },
    { label: "Flashcards", to: "/drill", meta: content ? String(content.flashcards.length) : "" },
    { label: "Study plan", to: "/plan", meta: "" },
    { label: "Analytics", to: "/analytics", meta: "" },
    { label: "Resources", to: "/resources", meta: "" },
    { label: "Setup", to: "/setup", meta: "" },
  ];

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        background: "var(--card)",
        borderRight: "1px solid var(--hairline)",
        padding: "20px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 18px" }}>
        <div
          style={{
            width: 16,
            height: 16,
            border: "1.5px solid var(--accent)",
            borderRadius: 3,
            transform: "rotate(45deg)",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-heading)", letterSpacing: "-0.01em" }}>
          SnowPro Core Prep
        </span>
      </div>

      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className="sidebar-link"
          style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 14,
            color: isActive ? "var(--text-heading)" : "var(--text-body)",
            background: isActive ? "var(--raised)" : "transparent",
            borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
          })}
        >
          <span>{item.label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            {item.meta}
          </span>
        </NavLink>
      ))}

      <div
        style={{
          marginTop: "auto",
          paddingTop: 16,
          borderTop: "1px solid var(--hairline-faint)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => {
            closeSettings();
            openPalette();
          }}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            minHeight: 36,
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <span>Search</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>{modKeyLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            closePalette();
            openSettings();
          }}
          style={{
            width: 34,
            height: 34,
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          ⚙
        </button>
      </div>
    </aside>
  );
}
