/**
 * Issue #59's forgot-password landing page — where an emailed reset link
 * (`/reset-password?token=...`) lands. Rendered by `App.tsx` for that one path, ahead of and
 * independent of the normal loading/gate/ready auth-state machine (see App.tsx's own comment):
 * this page must work in a browser with no session at all, which is the entire point of the flow,
 * so it can't wait on `GET /api/me` the way every other screen does.
 *
 * Visual language matches `LoginGate.tsx`/`SettingsPanel.tsx`'s overlay card (same tokens, same
 * border-radius/padding scale) rather than inventing a new one, and reuses `PasswordInput` for the
 * same show/hide-toggle behavior used everywhere else a password is typed.
 */

import { useState, type FormEvent } from "react";
import { confirmPasswordReset } from "../lib/session";
import { PasswordInput } from "./PasswordInput";

const MIN_PASSWORD_LENGTH = 8;

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

// How long the "Password updated" confirmation stays on screen before returning to the app --
// long enough to read, short enough not to feel stuck. Mirrors LoginGate's WELCOME_BACK_MS.
const SUCCESS_REDIRECT_MS = 1200;

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const result = await confirmPasswordReset(token, password);
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error);
      return;
    }
    setSucceeded(true);
    // Full navigation, not a React state transition -- same reasoning as login()/logout() in
    // session.ts: this clears any stale client state and lets the normal boot probe (GET /api/me)
    // run fresh against whatever session state now exists (none -- every session for this account
    // was invalidated server-side by the reset).
    setTimeout(() => {
      window.location.href = "/";
    }, SUCCESS_REDIRECT_MS);
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
      {!token ? (
        <div style={cardStyle}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--text-heading)" }}>
            Invalid reset link
          </h1>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            This link is missing its reset token. Request a new one from the login screen.
          </p>
        </div>
      ) : succeeded ? (
        <div style={cardStyle}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--text-heading)" }}>
            Password updated
          </h1>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            Taking you back to the app&hellip;
          </p>
        </div>
      ) : (
        <form onSubmit={submit} style={cardStyle}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--text-heading)" }}>
            Set a new password
          </h1>
          <p style={{ margin: "0 0 22px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            This link expires 1 hour after it was requested and works once.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle} htmlFor="reset-password">
              New password
            </label>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={200}
              value={password}
              onChange={setPassword}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle} htmlFor="reset-password-confirm">
              Confirm password
            </label>
            <PasswordInput
              id="reset-password-confirm"
              autoComplete="new-password"
              required
              maxLength={200}
              value={confirmPassword}
              onChange={setConfirmPassword}
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
            {submitting ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}
    </div>
  );
}
