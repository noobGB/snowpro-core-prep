/**
 * "Who's studying?" gate screen — email + name, no password (an explicit, confirmed design
 * decision for a trusted-LAN feature, not an oversight: see the LAN multi-user plan). Rendered by
 * App.tsx in place of the routed app for as long as GET /api/me reports no session. Visual
 * language matches SettingsPanel.tsx's overlay card (same tokens, same border-radius/padding
 * scale) rather than inventing a new one, just centered on the page instead of docked to a
 * corner, since this is a full-page gate, not a dismissible panel over other content.
 */

import { useState, type FormEvent } from "react";
import { login } from "../lib/session";

// Same pattern pipeline/src/server.ts's POST /api/session enforces server-side (its own EMAIL_RE
// comment explains the choice) -- kept identical rather than relying on the browser's native
// type="email" validation, which is real but looser (e.g. accepts "a@b" with no dot in some
// browsers) and gives no chance to show this app's own error-message styling before a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const result = await login(trimmedEmail, name);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    // A full reload, not a React state transition -- see session.ts's login() doc comment for why
    // this is the actual mechanism, not a stopgap: it's what lets progress.ts pick up the fresh
    // session cookie with zero changes to that file.
    window.location.reload();
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

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle} htmlFor="login-name">
            Name
          </label>
          <input
            id="login-name"
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            style={inputStyle}
          />
        </div>

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
