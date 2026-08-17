/**
 * Catch-all 404 — any URL that doesn't match a real route (stale bookmark, typo, a removed
 * session/results id) lands here instead of a blank screen. Rendered inside AppShell like every
 * other page, so the sidebar/nav stays available as a way back rather than a dead end.
 */

import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, maxWidth: 440, margin: "10vh auto 0" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)" }}>
        404
      </div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>
        Nothing here
      </h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
        This page doesn't exist — check the address, or head back to the dashboard.
      </p>
      <Link
        to="/"
        style={{ display: "inline-flex", alignItems: "center", background: "var(--accent)", color: "var(--canvas)", borderRadius: 6, padding: "11px 18px", minHeight: 44, fontSize: 14, fontWeight: 500 }}
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
