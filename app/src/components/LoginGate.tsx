/**
 * "Who's studying?" gate screen — email first, password required (issue #46). Rendered by App.tsx
 * in place of the routed app for as long as GET /api/me reports no session. Visual language
 * matches SettingsPanel.tsx's overlay card (same tokens, same border-radius/padding scale) rather
 * than inventing a new one, just centered on the page instead of docked to a corner, since this
 * is a full-page gate, not a dismissible panel over other content.
 *
 * Per issue #46, an email submit resolves to one of four distinct modes, each with its own
 * heading and copy rather than one ambiguous "a field appeared" reveal (see session.ts's login()
 * doc comment for the exact state machine this mirrors):
 *  - "new": unknown email -> Name + a new-account Password field (+ confirm), created together.
 *  - "claim": a legacy (pre-#46) account with no password yet -> a "set a password" field (+
 *    confirm), framed as closing a gap, not correcting a mistake.
 *  - "password": a normal account -> a plain Password field, with an honest "no self-service
 *    reset" line since this app has no SMTP to power one.
 *  - "email": the default/reset state.
 * Issue #41's original "one round trip for a returning login" goal is structurally retired by
 * this feature -- verifying a secret requires asking for it, so two round trips (email, then
 * password) is the new floor for every returning login, not a regression to chase back down.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { login, type LoginResult } from "../lib/session";

// Same pattern pipeline/src/server.ts's POST /api/session enforces server-side (its own EMAIL_RE
// comment explains the choice) -- kept identical rather than relying on the browser's native
// type="email" validation, which is real but looser (e.g. accepts "a@b" with no dot in some
// browsers) and gives no chance to show this app's own error-message styling before a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// How long the "Welcome back" acknowledgment stays on screen before reloading -- long enough to
// actually read a short line, short enough that a genuinely-yours login doesn't feel delayed.
const WELCOME_BACK_MS = 700;

type Mode = "email" | "new" | "claim" | "password";

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

// New copy in this feature uses --text-muted, not --text-dim -- --text-dim already measures below
// WCAG AA contrast (per the 2026-08-18 audit), so nothing new should add to that debt.
const hintStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)" };

export function LoginGate() {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>("email");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const firstRevealedFieldRef = useRef<HTMLInputElement>(null);

  // Focus moves into the newly-revealed field the instant a mode change happens -- every user,
  // not just screen-reader users, benefits from not having to hunt for a field that just appeared.
  useEffect(() => {
    if (mode !== "email") firstRevealedFieldRef.current?.focus();
  }, [mode]);

  function resetToEmailMode() {
    setMode("email");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  function applyResult(result: LoginResult): void {
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    if (result.status === "new") {
      setMode("new");
      setSubmitting(false);
      return;
    }
    if (result.status === "needs_password_setup") {
      setMode("claim");
      setSubmitting(false);
      return;
    }
    if (result.status === "needs_password") {
      setMode("password");
      setSubmitting(false);
      return;
    }
    // status === "known": a real login (or account claim/creation) just completed server-side.
    // Only a plain returning password login gets the "Welcome back" moment -- greeting a
    // brand-new signup, or a just-claimed legacy account, as "back" would read oddly.
    if (mode === "password") {
      setWelcomeName(result.name);
      setTimeout(() => window.location.reload(), WELCOME_BACK_MS);
    } else {
      window.location.reload();
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("That doesn't look like a valid email address.");
      return;
    }

    if (mode === "new") {
      if (name.trim().length === 0) {
        setError("Let us know what to call you.");
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      setSubmitting(true);
      applyResult(await login(trimmedEmail, { name: name.trim(), password }));
      return;
    }

    if (mode === "claim") {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      setSubmitting(true);
      applyResult(await login(trimmedEmail, { newPassword: password }));
      return;
    }

    if (mode === "password") {
      setSubmitting(true);
      applyResult(await login(trimmedEmail, { password }));
      return;
    }

    // mode === "email": first submit, server decides which of the three modes above applies.
    setSubmitting(true);
    applyResult(await login(trimmedEmail));
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
          {mode === "new" && "What should we call you?"}
          {mode === "claim" && "Set a password to protect this account"}
          {mode === "password" && "Password"}
          {mode === "email" && "Who's studying?"}
        </h1>
        {mode === "email" && (
          <p style={{ margin: "0 0 22px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            Your email and password keep your progress separate from anyone else on this network.
          </p>
        )}
        {mode === "claim" && (
          <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            You&rsquo;ve been using this account without a password &mdash; set one now to keep
            others on this network from opening it.
          </p>
        )}

        <div style={{ marginBottom: mode === "email" ? 22 : 14 }}>
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
              // Every revealed mode's determination was made against the email value at the time
              // it was submitted -- editing it afterward resets to a clean slate rather than
              // letting a stale mode/field set linger against a now-different email.
              if (mode !== "email") resetToEmailMode();
            }}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        {mode === "new" && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="login-name">
              Name
            </label>
            <p id="login-name-hint" style={hintStyle}>
              Haven&rsquo;t seen this email before &mdash; what should we call you?
            </p>
            <input
              ref={firstRevealedFieldRef}
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

        {(mode === "new" || mode === "claim") && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="login-password">
                {mode === "new" ? "Set a password" : "New password"}
              </label>
              <input
                ref={mode === "claim" ? firstRevealedFieldRef : undefined}
                id="login-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle} htmlFor="login-password-confirm">
                Confirm password
              </label>
              <input
                id="login-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                maxLength={200}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
            <p style={{ margin: "0 0 22px", fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)" }}>
              There&rsquo;s no self-service password reset in this app &mdash; if you forget it,
              ask the app operator to reset it for you.
            </p>
          </>
        )}

        {mode === "password" && (
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle} htmlFor="login-password-only">
              Password
            </label>
            <input
              ref={firstRevealedFieldRef}
              id="login-password-only"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <p style={{ margin: "8px 0 22px", fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)" }}>
              Forgot? Ask the app operator.
            </p>
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
