/**
 * Bottom-sheet overflow menu for the 5 destinations that don't fit in the mobile bottom nav's
 * 4 direct tabs (Home/Notes/Practice/Drill — the highest-frequency, "several times a day"
 * destinations; see MobileBottomNav's own doc comment). Triggered by that bar's "More" tab.
 * Settings has no route of its own — it's a shared modal (settingsStore) — so it's listed here
 * as the sheet's first row, above the 5 page links and set off by its own divider: it's an
 * *action* (opens a panel) not a *destination* (navigates), and putting it first means it's found
 * in one glance after one tap instead of buried last below 5 other rows.
 */

import { Link, useLocation } from "react-router-dom";
import { openSettings } from "../lib/settingsStore";

interface MoreItem {
  label: string;
  to: string;
}

const ITEMS: MoreItem[] = [
  { label: "Study plan", to: "/plan" },
  { label: "Mock exams", to: "/mocks" },
  { label: "Analytics", to: "/analytics" },
  { label: "Resources", to: "/resources" },
  { label: "Setup", to: "/setup" },
];

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 48,
  padding: "12px 20px",
  fontSize: 15,
  color: "var(--text-body)",
};

export function MobileMoreSheet({ onClose }: { onClose: () => void }) {
  const location = useLocation();

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(5,5,6,.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--raised)",
          border: "1px solid var(--hairline)",
          borderBottom: "none",
          borderRadius: "12px 12px 0 0",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline-strong)" }} />
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            openSettings();
          }}
          style={{ ...rowStyle, width: "100%", background: "transparent", border: "none", borderBottom: "6px solid var(--canvas)", textAlign: "left", cursor: "pointer" }}
        >
          Settings
        </button>
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClose}
            style={{
              ...rowStyle,
              borderBottom: "1px solid var(--hairline-faint)",
              color: location.pathname.startsWith(item.to) ? "var(--text-heading)" : "var(--text-body)",
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
