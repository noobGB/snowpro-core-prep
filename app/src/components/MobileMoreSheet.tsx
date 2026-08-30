/**
 * Bottom-sheet overflow menu for the destinations that don't fit in the mobile bottom nav's 4
 * direct tabs (Home / Mock exams / Settings / Notes-or-Admin — see MobileBottomNav's own doc
 * comment). Triggered by that bar's "More" tab.
 *
 * Notes moves in here instead of Sidebar's usual position whenever the session is an admin, since
 * the bottom bar's fourth slot is taken by Admin in that case — same "shown only for admins, real
 * enforcement is server-side" rule as Sidebar.tsx's Admin link applies to that swap.
 */

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSessionUser } from "../lib/session";

interface MoreItem {
  label: string;
  to: string;
}

const BASE_ITEMS: MoreItem[] = [
  { label: "Practice", to: "/practice" },
  { label: "Drill", to: "/drill" },
  { label: "Study plan", to: "/plan" },
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
  const sessionUser = useSessionUser();
  const items = sessionUser?.role === "admin" ? [{ label: "Notes", to: "/notes/d1" }, ...BASE_ITEMS] : BASE_ITEMS;

  // Escape dismisses the sheet, matching every other overlay in this app (SettingsPanel,
  // CommandPalette) — this one was missing it entirely.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
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
          boxShadow: "var(--overlay-shadow)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline-strong)" }} />
        </div>
        {items.map((item) => (
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
