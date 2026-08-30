/**
 * Persistent 240px sidebar, per Nav.dc.html: nine flat destination links, plus Search and
 * Settings. The two aren't paired at the foot the way the original wireframe had them — a UX
 * pass found that placement made both nearly invisible (confirmed: a user missed the gear
 * entirely) and that they're different kinds of control anyway. Search is high-frequency, so it
 * sits at the very top, right under the logo, matching Notion/Linear's placement for the same
 * reason. Settings is genuinely occasional (light mode, backup, destructive reset) — corner
 * placement is the right, expected pattern for that (VS Code/Slack/Discord all do this); the bug
 * there was never location, it was a 34px unlabeled low-contrast glyph. Fixed to a full-width row
 * with a real icon and text-body contrast. Active state is a raised fill with a 2px accent bar at
 * the left edge. Meta badges (domain/question/mock counts) come from content.json.
 */

import { Link, NavLink } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { closePalette, openPalette } from "../lib/paletteStore";
import { closeSettings, openSettings } from "../lib/settingsStore";
import { modKeyLabel } from "../lib/platform";
import { useSessionUser } from "../lib/session";

interface NavItem {
  label: string;
  to: string;
  meta: string;
}

export function Sidebar() {
  const { content } = useContent();
  const sessionUser = useSessionUser();

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
  // Issue #62: only shown once the session store actually knows this account is an admin — real
  // enforcement is server-side (requireAdmin), this is purely about not showing a link that would
  // just 403 for everyone else.
  if (sessionUser?.role === "admin") items.push({ label: "Admin", to: "/admin", meta: "" });

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
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 14px" }}>
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
      </Link>

      <button
        type="button"
        onClick={() => {
          closeSettings();
          openPalette();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          minHeight: 36,
          marginBottom: 14,
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
      <div style={{ borderBottom: "1px solid var(--hairline-faint)", marginBottom: 10 }} />

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

      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--hairline-faint)" }}>
        <button
          type="button"
          onClick={() => {
            closePalette();
            openSettings();
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "8px 12px",
            minHeight: 38,
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-body)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
