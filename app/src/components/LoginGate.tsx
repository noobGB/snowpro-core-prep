/**
 * "Who's studying?" gate screen — email first, no password (an explicit, confirmed design
 * decision for a trusted-LAN feature, not an oversight: see the LAN multi-user plan). Rendered by
 * App.tsx in place of the routed app for as long as GET /api/me reports no session. Visual
 * language matches SettingsPanel.tsx's overlay card (same tokens, same border-radius/padding
 * scale) rather than inventing a new one, just centered on the page instead of docked to a
 * corner, since this is a full-page gate, not a dismissible panel over other content.
 *
 * Per issue #41: a returning email logs in on the first submit alone (one round trip, matching
 * what it cost before this issue) -- the Name field only ever appears for a genuinely new email
 * (session.ts's login() returns `{status: "new"}` without creating an account or a cookie), and a
 * known email gets a brief "Welcome back, {name}" acknowledgment before reloading. That's not
 * decoration: on a shared, passwordless, LAN device, browser autofill on the email field can
 * silently select a similar-but-wrong saved address, and this is the first real feedback moment
 * in the whole flow that would make a wrong pick obviously wrong before it's too late to notice.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { login } from "../lib/session";

// Same pattern pipeline/src/server.ts's POST /api/session enforces server-side (its own EMAIL_RE
// comment explains the choice) -- kept identical rather than relying on the browser's native
// type="email" validation, which is real but looser (e.g. accepts "a@b" with no dot in some
// browsers) and gives no chance to show this app's own error-message styling before a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// How long the "Welcome back" acknowledgment stays on screen before reloading -- long enough to
// actually read a short line, short enough that a genuinely-yours login doesn't feel delayed.
const WELCOME_BACK_MS = 700;

const cardStyle: React.CSSProperties = {
  width: 360,
  maxWidth: "calc(100vw - 32px)",
  background: "var(--raised)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
  padding: 28,
  boxShadow: "var(--overlay-shadow)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--card)",
  border: "1px solid var(--hairline)",
  borderRadius: 6,
  color: "var(--text-body)",
  fontSize: 14,
  padding: "10px 12px",
  minHeight: 44,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-dim)",
  marginBottom: 6,
};

export function LoginGate() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus moves into the Name field the instant it's revealed -- every user, not just
  // screen-reader users, benefits from not having to hunt for a field that just appeared.
  useEffect(() => {
    if (needsName) nameInputRef.current?.focus();
  }, [needsName]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("That doesn't look like a valid email address.");
      return;
    }
    setSubmitting(true);

    // Only send a name once the server has already told us this email needs one -- see
    // session.ts's login() doc comment for why this keeps a returning login to one round trip.
    const result = needsName ? await login(trimmedEmail, name.trim()) : await login(trimmedEmail);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    if (result.status === "new") {
      setNeedsName(true);
      setSubmitting(false);
      return;
    }
    // status === "known": either a returning email (first submit alone resolved it) or an
    // account that was just created on this exact submit (needsName was true). Only the former
    // gets the "Welcome back" moment -- greeting a brand-new signup as "back" would be backwards.
    if (needsName) {
      window.location.reload();
    } else {
      setWelcomeName(result.name);
      setTimeout(() => window.location.reload(), WELCOME_BACK_MS);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--canvas)",
        padding: 16,
      }}
    >
      <form onSubmit={submit} style={cardStyle}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>
          COF-C03
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--text-heading)" }}>
          Who's studying?
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
          Your email keeps your progress separate from anyone else on this network. No password —
          just enter the same email next time to pick up where you left off.
        </p>

        <div style={{ marginBottom: needsName ? 14 : 22 }}>
          <label style={labelStyle} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // The Name field's presence must always reflect a determination made against the
              // CURRENT email value, not a stale one -- editing email after a reveal resets it,
              // rather than locking the field or letting it get out of sync.
              if (needsName) setNeedsName(false);
            }}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        {needsName && (
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle} htmlFor="login-name">
              Name
            </label>
            <p id="login-name-hint" style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.4, color: "var(--text-dim)" }}>
              Haven't seen this email before — what should we call you?
            </p>
            <input
              ref={nameInputRef}
              id="login-name"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby="login-name-hint"
              placeholder="What should we call you?"
              style={inputStyle}
            />
          </div>
        )}

        {welcomeName && (
          <div style={{ fontSize: 13, color: "var(--text-heading)", marginBottom: 14 }}>Welcome back, {welcomeName}.</div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: "var(--status-incorrect)", marginBottom: 14, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            background: "var(--accent)",
            color: "var(--canvas)",
            border: "none",
            borderRadius: 6,
            padding: "11px 0",
            minHeight: 44,
            fontSize: 14,
            fontWeight: 500,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Continuing…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
