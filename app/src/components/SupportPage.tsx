/**
 * The support form (issue #193) — reached at /support.
 *
 * WHY IT IS A STANDALONE PAGE, not a panel: it has to work for someone with no session. The most
 * urgent support request is "I can't sign in", and that person cannot open Settings to find a
 * contact form. `App.tsx` renders this ahead of its auth-state branches, exactly as
 * `ResetPasswordPage` already does for the same reason.
 *
 * WHAT IS PRE-FILLED, AND WHAT DELIBERATELY IS NOT. A signed-in real account's name and email are
 * filled and shown read-only — the server uses the session's own address regardless of what the
 * body says, so an editable field would be theatre.
 *
 * A GUEST IS NOT PRE-FILLED. `createGuestUser()` mints `guest-<32 hex>@guest.invalid`, an RFC 2606
 * address that can never receive mail. Pre-filling it would produce a support request that looks
 * answerable and isn't — the reporter waits for a reply that cannot arrive. Guests are asked for a
 * real address like a signed-out visitor, and told why.
 *
 * The honeypot `website` field is hidden from sight but NOT with `display:none` alone — some bots
 * skip those. It is off-screen and `tabIndex={-1}` with `aria-hidden`, so keyboard and screen
 * reader users never reach it either.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useSessionUser } from "../lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 5000;

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "var(--card)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
  padding: 28,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-dim)",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--raised)",
  border: "1px solid var(--hairline)",
  borderRadius: 6,
  color: "var(--text-body)",
  fontSize: 14,
  padding: "9px 11px",
  minHeight: 38,
};

export function SupportPage() {
  const me = useSessionUser();
  const isGuest = me?.isGuest === true;
  const account = me && !isGuest ? me : null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The session resolves after first paint, so this fills the fields when it arrives rather than
  // only on mount. Guarded on `account` so a guest's unusable address never lands in the input.
  useEffect(() => {
    if (account) {
      setName(account.name);
      setEmail(account.email);
    }
  }, [account]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);

    if (message.trim().length < 10) {
      setError("Please describe the problem in a little more detail.");
      return;
    }
    if (!account && !EMAIL_RE.test(email.trim())) {
      setError("Enter an email address we can reply to.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          website,
          // The page they came from. They would not think to include it, and it is the difference
          // between an actionable report and "one of the questions was wrong".
          path: document.referrer || window.location.pathname,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Couldn't send that (${res.status}).`);
        setSending(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — check your connection and try again.");
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={cardStyle}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
          Support
        </div>

        {sent ? (
          <>
            <h1 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 500, color: "var(--text-heading)" }}>Thanks — that's on its way.</h1>
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
              You&rsquo;ll get a reply at <strong>{email}</strong>. This is a project maintained by
              one person, so it may take a few days &mdash; but a real person reads every message.
            </p>
            <a href="/" style={{ fontSize: 14, color: "var(--accent)" }}>
              &larr; Back to the app
            </a>
          </>
        ) : (
          <>
            <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 500, color: "var(--text-heading)" }}>Something wrong? Tell us.</h1>
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
              Especially if a practice question looks wrong &mdash; that&rsquo;s the most useful
              thing you can send, and it gets fixed for everyone.
            </p>

            <form onSubmit={submit}>
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="support-name" style={labelStyle}>Your name</label>
                <input
                  id="support-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!!account}
                  maxLength={80}
                  placeholder="What should we call you?"
                  style={{ ...inputStyle, opacity: account ? 0.7 : 1 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label htmlFor="support-email" style={labelStyle}>Email to reply to</label>
                <input
                  id="support-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={!!account}
                  placeholder="you@example.com"
                  style={{ ...inputStyle, opacity: account ? 0.7 : 1 }}
                />
                {account && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
                    From your account &mdash; change it in Settings.
                  </div>
                )}
                {isGuest && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
                    You&rsquo;re on the demo account, which has no real address &mdash; give us one
                    we can actually reply to.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 6 }}>
                <label htmlFor="support-message" style={labelStyle}>What happened?</label>
                <textarea
                  id="support-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  maxLength={MAX_MESSAGE}
                  placeholder="If it's a question, paste the question or say which domain it was in. If something's broken, what were you doing when it happened?"
                  style={{ ...inputStyle, minHeight: 140, resize: "vertical", fontFamily: "inherit", lineHeight: 1.55 }}
                />
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5, textAlign: "right" }}>
                  {message.length} / {MAX_MESSAGE}
                </div>
              </div>

              {/* Honeypot. Off-screen rather than display:none (some bots skip hidden inputs), and
                  removed from the tab order and the accessibility tree so no real user meets it. */}
              <div style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                <label htmlFor="support-website">Leave this empty</label>
                <input id="support-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              <button
                type="submit"
                disabled={sending}
                style={{
                  width: "100%",
                  marginTop: 10,
                  background: sending ? "var(--hairline)" : "var(--accent)",
                  color: sending ? "var(--text-dim)" : "var(--canvas)",
                  border: "none",
                  borderRadius: 6,
                  padding: "11px 0",
                  minHeight: 40,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: sending ? "default" : "pointer",
                }}
              >
                {sending ? "Sending…" : "Send message"}
              </button>

              {error && (
                <div style={{ fontSize: 13, color: "var(--status-incorrect)", marginTop: 10 }}>{error}</div>
              )}
            </form>

            <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 20, paddingTop: 14 }}>
              <a href="/" style={{ fontSize: 13, color: "var(--text-muted)" }}>&larr; Back to the app</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
