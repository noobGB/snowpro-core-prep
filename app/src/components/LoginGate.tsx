/**
 * "Who's studying?" login/signup form (issue #46) -- email first, password required. Exported as
 * `AuthForm` so it can be mounted two different ways depending on the visitor (issue #123):
 *  - `LoginGate` (below) wraps it in a full-screen centered card, unchanged from before -- used
 *    for a LAN/localhost visitor, who gets a bare login screen with no marketing content at all
 *    (see App.tsx's isPublicHost branch).
 *  - `HomePage.tsx` mounts `AuthForm` directly as one column of a split-screen layout, alongside
 *    pitch/feature content, for a public-host visitor -- one persistent screen, not a click-through
 *    from a separate landing page (issue #121's one-time dismissible landing page was rejected on
 *    exactly this point: "no disappearing home page," "one home page which includes the login
 *    container").
 * Either way this component's own state machine and all six modes below are completely unchanged.
 *
 * Visual language matches SettingsPanel.tsx's overlay card (same tokens, same border-radius/padding
 * scale) rather than inventing a new one.
 *
 * Per issue #46, an email submit resolves to one of four distinct modes, each with its own
 * heading and copy rather than one ambiguous "a field appeared" reveal (see session.ts's login()
 * doc comment for the exact state machine this mirrors):
 *  - "new": unknown email -> Name + a new-account Password field (+ confirm), created together.
 *  - "claim": a legacy (pre-#46) account with no password yet -> a "set a password" field (+
 *    confirm), framed as closing a gap, not correcting a mistake.
 *  - "password": a normal account -> a plain Password field, with a real "Forgot password?" link
 *    (issue #59) into the fifth mode below.
 *  - "email": the default/reset state.
 * Issue #41's original "one round trip for a returning login" goal is structurally retired by
 * this feature -- verifying a secret requires asking for it, so two round trips (email, then
 * password) is the new floor for every returning login, not a regression to chase back down.
 *
 * A fifth mode, "forgot" (issue #59), is reached only from "password" mode's link, never from the
 * server's own email-submit response -- it doesn't need a round trip to determine, unlike the
 * other four. Submitting it calls `requestPasswordReset()`, which always resolves the same generic
 * "check your email" confirmation regardless of whether the account exists (see that function's own
 * doc comment) -- this component never learns, and must never display, whether the email it was
 * given actually has an account.
 *
 * A sixth mode, "must_change_password" (issue #62), IS reached from the server's email-submit
 * response, same as "claim" -- an admin-provisioned account (`Admin.tsx`) already has a real
 * (temporary) password, so it can't reuse "claim"'s "no password yet" framing. Needs three fields
 * at once (temporary password + new password + confirm) rather than "claim"'s two, since the temp
 * password has to be verified, not just replaced.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { login, requestPasswordReset, type LoginResult } from "../lib/session";
import { GuestDemoButton } from "./GuestDemoButton";
import { PasswordInput } from "./PasswordInput";

// Same pattern pipeline/src/server.ts's POST /api/session enforces server-side (its own EMAIL_RE
// comment explains the choice) -- kept identical rather than relying on the browser's native
// type="email" validation, which is real but looser (e.g. accepts "a@b" with no dot in some
// browsers) and gives no chance to show this app's own error-message styling before a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// How long the "Welcome back" acknowledgment stays on screen before reloading -- long enough to
// actually read a short line, short enough that a genuinely-yours login doesn't feel delayed.
const WELCOME_BACK_MS = 700;

type Mode = "email" | "new" | "claim" | "password" | "forgot" | "must_change_password";

const cardStyle: React.CSSProperties = {
  width: 360,
  // `100%`, not the `calc(100vw - 32px)` this used to be. Both mounts wrap this card in a flex
  // container, so a percentage resolves against that container's content box and is correct for
  // each: LoginGate's full-screen wrapper (100vw minus its own 16px padding, i.e. exactly what the
  // old calc() hardcoded) AND HomePage's `.home-form` grid cell, which is narrower than the
  // viewport because the page has its own 24px gutters -- there the viewport-relative calc()
  // resolved 16px too wide and overflowed.
  maxWidth: "100%",
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

/** The single "or" rule separating the primary email/password action from the alternative ways in
 *  (Google, the demo). Rendered ONCE for the whole alternatives block rather than once per option
 *  -- two stacked "or" rules on a 360px card reads as a rendering fault, and that is literally
 *  what shipped when the demo block carried its own. */
function AlternativesDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }} aria-hidden="true">
      <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
    </div>
  );
}

interface AuthFormProps {
  /** Defaults to "h1" for standalone `LoginGate` (its own page, this heading IS the page's
   *  top-level heading) -- `HomePage.tsx` passes "h2" instead, since it already renders its own
   *  `<h1>` for the hero and two `<h1>`s on one screen is a real heading-hierarchy/screen-reader-
   *  navigation bug, not just a style nit (axe's `page-has-heading-one`/`heading-order` rules
   *  both flag it). */
  headingLevel?: "h1" | "h2";
  /** Issue #160: render "Explore the demo" inside this card's alternatives block. Only HomePage
   *  passes it (and only when the server said so) -- `LoginGate`'s LAN path leaves it false, so a
   *  self-hosted box can never grow a demo button by accident. See GuestDemoButton.tsx's header
   *  comment for why the button lives inside this card rather than beside it. */
  guestAvailable?: boolean;
}

export function AuthForm({ headingLevel = "h1", guestAvailable = false }: AuthFormProps = {}) {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>("email");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const firstRevealedFieldRef = useRef<HTMLInputElement>(null);

  // Focus moves into the newly-revealed field the instant a mode change happens -- every user,
  // not just screen-reader users, benefits from not having to hunt for a field that just appeared.
  useEffect(() => {
    if (mode !== "email") firstRevealedFieldRef.current?.focus();
  }, [mode]);

  // Issue #113: only show "Continue with Google" once this deployment actually has it configured
  // -- otherwise the button would 404 on click for any deployment (or any moment before Gaurav's
  // finished the separate Google Cloud Console setup) that hasn't set SNOWPRO_GOOGLE_*.
  useEffect(() => {
    fetch("/api/oauth/google/available")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((body: { available?: boolean }) => setGoogleAvailable(body.available === true))
      .catch(() => setGoogleAvailable(false));
  }, []);

  function resetToEmailMode() {
    setMode("email");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setTempPassword("");
    setResetLinkSent(false);
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
    if (result.status === "must_change_password") {
      setMode("must_change_password");
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

    if (mode === "must_change_password") {
      if (tempPassword.length === 0) {
        setError("Enter the temporary password you were sent.");
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
      applyResult(await login(trimmedEmail, { password: tempPassword, newPassword: password }));
      return;
    }

    if (mode === "forgot") {
      setSubmitting(true);
      const result = await requestPasswordReset(trimmedEmail);
      setSubmitting(false);
      // A failure here is a real server-side problem (network error, or SMTP genuinely unconfigured
      // -- see requestPasswordReset()'s own doc comment on why that one case is safe to surface),
      // never "this email doesn't have an account" -- that fact is never revealed to this component.
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResetLinkSent(true);
      return;
    }

    // mode === "email": first submit, server decides which of the three modes above applies.
    setSubmitting(true);
    applyResult(await login(trimmedEmail));
  };

  // Reached only from "password" mode's "Forgot password?" link -- unlike resetToEmailMode(), this
  // deliberately keeps whatever email is already typed rather than clearing it back to "email" mode.
  function goToForgotMode() {
    setMode("forgot");
    setPassword("");
    setConfirmPassword("");
    setResetLinkSent(false);
    setError(null);
  }

  return (
      <form onSubmit={submit} style={cardStyle}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>
          COF-C03
        </div>
        {(() => {
          const Heading = headingLevel;
          return (
            <Heading style={{ margin: mode === "email" ? "0 0 22px" : "0 0 6px", fontSize: 22, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--text-heading)" }}>
              {mode === "new" && "What should we call you?"}
              {mode === "claim" && "Set a password to protect this account"}
              {mode === "password" && "Password"}
              {mode === "forgot" && "Reset your password"}
              {mode === "must_change_password" && "Set your password"}
              {mode === "email" && "Who's studying?"}
            </Heading>
          );
        })()}
        {mode === "claim" && (
          <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            You&rsquo;ve been using this account without a password &mdash; set one now to keep
            others on this network from opening it.
          </p>
        )}
        {mode === "must_change_password" && (
          <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            An admin created this account for you. Enter the temporary password you were emailed,
            then choose a real one.
          </p>
        )}
        {mode === "forgot" && !resetLinkSent && (
          <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            Enter your email and we&rsquo;ll send a link to reset your password.
          </p>
        )}
        {mode === "forgot" && resetLinkSent && (
          <p style={{ margin: "0 0 22px", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
            If that email has an account, we&rsquo;ve sent a reset link to it &mdash; check your
            inbox. The link expires in 1 hour.
          </p>
        )}

        {!(mode === "forgot" && resetLinkSent) && (
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
        )}

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
              <PasswordInput
                inputRef={mode === "claim" ? firstRevealedFieldRef : undefined}
                id="login-password"
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
              <label style={labelStyle} htmlFor="login-password-confirm">
                Confirm password
              </label>
              <PasswordInput
                id="login-password-confirm"
                autoComplete="new-password"
                required
                maxLength={200}
                value={confirmPassword}
                onChange={setConfirmPassword}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {mode === "must_change_password" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="login-temp-password">
                Temporary password
              </label>
              <PasswordInput
                inputRef={firstRevealedFieldRef}
                id="login-temp-password"
                autoComplete="current-password"
                required
                maxLength={200}
                value={tempPassword}
                onChange={setTempPassword}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="login-password">
                New password
              </label>
              <PasswordInput
                id="login-password"
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
              <label style={labelStyle} htmlFor="login-password-confirm">
                Confirm password
              </label>
              <PasswordInput
                id="login-password-confirm"
                autoComplete="new-password"
                required
                maxLength={200}
                value={confirmPassword}
                onChange={setConfirmPassword}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {mode === "password" && (
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle} htmlFor="login-password-only">
              Password
            </label>
            <PasswordInput
              inputRef={firstRevealedFieldRef}
              id="login-password-only"
              autoComplete="current-password"
              required
              maxLength={200}
              value={password}
              onChange={setPassword}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={goToForgotMode}
              style={{
                display: "block",
                margin: "8px 0 22px",
                padding: 0,
                background: "none",
                border: "none",
                fontSize: 12,
                color: "var(--accent)",
                cursor: "pointer",
              }}
            >
              Forgot password?
            </button>
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

        {mode === "forgot" && resetLinkSent ? (
          <button
            type="button"
            onClick={resetToEmailMode}
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
              cursor: "pointer",
            }}
          >
            Back to login
          </button>
        ) : (
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
            {submitting ? "Continuing…" : mode === "forgot" ? "Send reset link" : "Continue"}
          </button>
        )}
        {/* The alternatives block: everything that is not "type an email and a password". Gated to
            "email" mode for the same reason the Google button always was -- once someone has
            committed to an address and is looking at a password field, offering two other ways in
            is noise on the one screen that most needs to be single-purpose. Both options are
            optional and independent, so the shared divider is conditioned on either being present,
            never on Google alone. */}
        {mode === "email" && (googleAvailable || guestAvailable) && (
          <>
            <AlternativesDivider />
            {/* FIRST in the alternatives block, ahead of Google. The password field above the
                divider is still the first thing a returning daily user sees, so their muscle memory
                is untouched -- but within the "other ways in" group this is the one that works for
                someone who has no account yet, which is everyone arriving from a shared link. It
                was previously last, under Google, where it read as an afterthought. */}
            {guestAvailable && (
              <div style={{ marginBottom: googleAvailable ? 12 : 0 }}>
                <GuestDemoButton />
              </div>
            )}
            {googleAvailable && (
            <>
            {/* A plain page navigation, not a fetch/submit -- issue #113's OAuth flow needs the
                browser to actually leave this page for accounts.google.com; see oauth.ts's header
                comment for the full mechanism. Ends in a redirect back to "/", which naturally
                hits the same reload-driven login this app's password path already uses.
                Styled to Google's own official "Continue with Google" button spec (Google Identity
                brand guidelines: exact --google-btn-* colors per theme, tokens.css; the official
                multi-color "G" logo, published specifically for third-party sign-in buttons like
                this one) rather than this app's own button language -- Google's guidelines don't
                permit recoloring their button to an app's own accent/surface colors. */}
            <a
              href="/api/oauth/google/start"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                width: "100%",
                boxSizing: "border-box",
                background: "var(--google-btn-bg)",
                color: "var(--google-btn-text)",
                border: "1px solid var(--google-btn-border)",
                borderRadius: 4,
                padding: "0 12px",
                minHeight: 40,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "Roboto, var(--font-sans)",
                textDecoration: "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </a>
            </>
            )}
          </>
        )}
      </form>
  );
}

/** Full-screen centered wrapper around `AuthForm` -- used for a LAN/localhost visitor (see
 *  App.tsx's isPublicHost branch), who gets a bare login screen with no pitch content, unchanged
 *  from before issue #123's redesign. A public-host visitor gets `AuthForm` mounted directly
 *  inside `HomePage.tsx`'s split-screen layout instead of this wrapper. */
export function LoginGate() {
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
      <AuthForm />
    </div>
  );
}
