/**
 * "Explore the demo" (issue #160) — the entry point that lets a visitor arriving from a shared link
 * use the real app without registering first.
 *
 * Rendered by HomePage.tsx into the form column, beneath AuthForm. That placement is deliberate:
 * the split-screen layout puts the form top-right at >=900px and second in DOM order below that
 * (see HomePage.tsx's own layout comment), so the form column is the one place that is in the
 * primary eye path *and* the primary reading order at every breakpoint. A second CTA up in the hero
 * was considered and rejected — two buttons for one action splits the decision and doubles the copy
 * that has to stay in sync.
 *
 * Deliberately its own component rather than another branch inside AuthForm: AuthForm is shared
 * with LoginGate, which is the LAN path. Keeping this separate means the LAN gate cannot grow a
 * demo button by accident — a guest row on a self-hosted box is litter with no conversion upside,
 * and that visitor was invited by the operator anyway. The server agrees independently
 * (`guestAvailable` is false on a private-network host), so this is belt and braces, not the only
 * guard.
 */

import { useState } from "react";
import { startGuestSession } from "../lib/session";

export function GuestDemoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await startGuestSession();
    if (!result.ok) {
      // Covers the deliberate 429/503 refusals too (rate limit, capacity) -- the server's message
      // is written for this surface, so show it rather than a generic failure.
      setError(result.error);
      setBusy(false);
      return;
    }
    // Full reload, not a state transition -- see startGuestSession()'s doc comment.
    window.location.reload();
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "0 0 16px",
          color: "var(--text-dim)",
          fontSize: 12,
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} aria-hidden="true" />
        or
        <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          width: "100%",
          padding: "11px 16px",
          borderRadius: 8,
          border: "1px solid var(--hairline)",
          background: "transparent",
          color: "var(--text-heading)",
          fontSize: 14,
          fontWeight: 500,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Starting the demo…" : "Explore the demo — no signup"}
      </button>

      <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-dim)" }}>
        The full app with real questions. Your progress is saved and you can turn it into an account
        whenever you like. Mock exams need a free account.
      </p>

      {error && (
        <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--danger, #ff6b6b)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
