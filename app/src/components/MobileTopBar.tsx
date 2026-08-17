/** Narrow-viewport top bar replacing the sidebar's logo + search trigger, per the wireframes'
 *  mobile layout (logo, search button — no nav links here, those move to the bottom bar). */

import { openPalette } from "../lib/paletteStore";

export function MobileTopBar() {
  return (
    <div
      className="mobile-only"
      style={{
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--card)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 14, height: 14, border: "1.5px solid var(--accent)", borderRadius: 3, transform: "rotate(45deg)" }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-heading)" }}>SnowPro Core Prep</span>
      </div>
      <button
        type="button"
        onClick={openPalette}
        style={{ padding: "8px 12px", minHeight: 44, border: "1px solid var(--hairline)", borderRadius: 6, background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}
      >
        Search
      </button>
    </div>
  );
}
