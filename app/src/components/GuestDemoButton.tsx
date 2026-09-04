/**
 * "Explore the demo" (issue #160) — the entry point that lets a visitor arriving from a shared link
 * use the real app without registering first.
 *
 * Rendered by `AuthForm` (LoginGate.tsx) INSIDE the sign-in card, in the alternatives block below
 * the primary Continue button, next to "Continue with Google" and sharing that block's single
 * "or" divider. It is not a standalone element and deliberately owns no outer spacing, divider or
 * width of its own — the card owns all three.
 *
 * That containment is load-bearing, not cosmetic. The first cut mounted this as a sibling of
 * `<AuthForm/>` inside HomePage's `.home-form` grid cell — but `.home-form` is `display: flex`
 * (its documented job is centering AuthForm's fixed-width card inside a wider grid column), so a
 * second child became a second flex item on the same ROW: both shrank, the 360px sign-in card was
 * crushed to 175px with its heading and email placeholder clipped, and this block ended up
 * floating in the right margin with its own "or" divider stranded in dead space. Measured, not
 * eyeballed. Living inside the card makes that class of bug structurally impossible at every
 * breakpoint, and removes the second, competing "or" divider at the same time.
 *
 * Still its own component rather than a branch inside AuthForm's JSX: AuthForm is shared with
 * LoginGate, which is the LAN path. AuthForm only renders this when its caller passes
 * `guestAvailable`, and only HomePage does — a guest row on a self-hosted box is litter with no
 * conversion upside, and that visitor was invited by the operator anyway. The server agrees
 * independently (`guestAvailable` is false on a private-network host), so this is belt and braces,
 * not the only guard.
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
    <div data-testid="guest-demo">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-describedby="guest-demo-hint"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "0 12px",
          minHeight: 40,
          borderRadius: 6,
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

      {/* --text-muted, not --text-dim: this is body copy at 12px, and --text-dim is calibrated for
          labels/chips. Kept to two short sentences -- the card is 360px wide and this sits under
          a third button, so a paragraph here reads as fine print nobody finishes. */}
      <p id="guest-demo-hint" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
        The real app, with real questions. Turn it into an account any time and keep what you did.
      </p>

      {error && (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--status-incorrect)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
