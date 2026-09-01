/**
 * One-screen marketing pitch shown to a first-time, signed-out visitor arriving over a public
 * hostname (issue #121) -- rendered by App.tsx in place of LoginGate for exactly that case, so a
 * stranger reaching the deployed app from a shared link, the GitHub README, or a bare URL sees a
 * value proposition before being asked to create an account, rather than a bare "Who's studying?"
 * form with zero context. LAN/localhost visitors (App.tsx's isPublicHost check, reusing issue
 * #119's isPrivateNetworkHost()) and anyone who's already clicked through once (App.tsx's
 * localStorage dismiss flag) skip this entirely and land straight on LoginGate -- a pitch is
 * friction, not value, for someone who already has context.
 *
 * Content mirrors README.md's own "Why this exists"/"Features" sections rather than inventing new
 * copy, so the pitch stays truthful to what's actually shipped and doesn't drift from the README
 * over time without a matching edit here.
 *
 * Visual language matches LoginGate.tsx/SettingsPanel.tsx (same tokens, same radius/padding scale)
 * rather than inventing a new one -- this is the same design system's cover page, not a separate
 * marketing site.
 */

const sectionMaxWidth = 880;

const ctaPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--accent)",
  color: "var(--canvas)",
  border: "none",
  borderRadius: 6,
  padding: "13px 28px",
  minHeight: 44,
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
};

const ctaSecondaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  color: "var(--text-muted)",
  border: "none",
  padding: "13px 8px",
  minHeight: 44,
  fontSize: 14,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const featureCardStyle: React.CSSProperties = {
  background: "var(--raised)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
  padding: 20,
};

interface Feature {
  title: string;
  body: string;
}

// Straight from README.md's own "Why this exists"/"Features" sections -- see this file's header
// comment on why the copy is meant to track the README, not diverge from it.
const FEATURES: Feature[] = [
  {
    title: "Timed mock exams",
    body: "Full-length, matching the real exam's question count and domain split -- one question per screen, flag-for-review, a jump palette, and results that put your wrong answers first.",
  },
  {
    title: "Weighted readiness",
    body: "A dashboard scored against the real exam's actual domain weights, not a flat percentage -- so you know exactly where the remaining study time should go.",
  },
  {
    title: "Conversational quizzing (MCP)",
    body: "Quiz yourself from Claude Desktop or Claude Code instead of clicking through a web UI -- same progress, same analytics, either way.",
  },
  {
    title: "Self-hosted, no telemetry",
    body: "Your content and progress stay on your machine or your local network. No account required to run it, no cloud service, nothing phoned home.",
  },
];

export function LandingPage({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--canvas)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "56px 20px 40px",
      }}
    >
      <div style={{ width: "100%", maxWidth: sectionMaxWidth, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 14 }}>
          COF-C03 · SNOWPRO CORE PREP
        </div>
        <h1 style={{ margin: "0 0 16px", fontSize: 34, lineHeight: 1.2, fontWeight: 500, letterSpacing: "-0.015em", color: "var(--text-heading)" }}>
          Turn a folder of study notes into a real exam-prep app
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: 16, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 620 }}>
          Not a paywalled question bank, not a pile of markdown with no way to drill yourself. Scored
          quizzes, timed mock exams matching the real SnowPro Core structure, and a readiness score
          weighted by actual exam domain weights -- built to prep for the real thing.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 44 }}>
          <button type="button" style={ctaPrimaryStyle} onClick={onContinue}>
            Start studying — free
          </button>
          <button type="button" style={ctaSecondaryStyle} onClick={onContinue}>
            Already have an account? Log in
          </button>
        </div>

        <img
          src="/landing-dashboard.png"
          alt="SnowPro Core Prep dashboard: exam countdown, weighted readiness, and today's plan tasks in one view."
          style={{
            width: "100%",
            maxWidth: 780,
            borderRadius: 12,
            border: "1px solid var(--hairline)",
            boxShadow: "var(--overlay-shadow)",
            marginBottom: 48,
          }}
        />

        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            textAlign: "left",
            marginBottom: 48,
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} style={featureCardStyle}>
              <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>{f.title}</h2>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)" }}>{f.body}</p>
            </div>
          ))}
        </div>

        <footer style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Open source ·{" "}
          <a href="https://github.com/noobGB/snowpro-core-prep" target="_blank" rel="noreferrer">
            github.com/noobGB/snowpro-core-prep
          </a>
        </footer>
      </div>
    </div>
  );
}
