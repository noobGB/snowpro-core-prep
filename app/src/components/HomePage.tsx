/**
 * The permanent home page for a signed-out visitor on a public hostname (issue #123 -- supersedes
 * #121's one-time, click-through landing page, rejected on exactly this point: "no disappearing
 * home page," "one home page which includes the login container"). Rendered by App.tsx whenever
 * `GET /api/me` reports no session AND the request arrived over a public host (real domain or
 * localhost, `session.ts`'s `isPublicHost`) -- shown on EVERY visit, forever, not dismissed after
 * a first click. A LAN visitor still gets the bare `LoginGate` instead (see App.tsx), unchanged
 * from #121/#119's confirmed direction there: a pitch is pure friction for someone who already has
 * context from whoever shared the address with them.
 *
 * Split-screen layout (`.home-grid` in tokens.css): pitch content left, `AuthForm` (the actual
 * login/signup form, extracted from LoginGate.tsx) right, on desktop (>=900px) -- a returning
 * daily user's eyes go straight to the known screen location, same idea as Railway's or Linear's
 * own split login pages. Below 900px, DOM order (hero -> AuthForm -> feature grid) becomes visual
 * order directly: a compact hero, then the form, then the feature cards as secondary scroll
 * content -- a daily returning mobile user shouldn't have to scroll past four feature cards to
 * reach the password field they use every day. The same DOM order also means a screen reader's
 * linear reading order reaches the form right after a short hero, not after the full feature grid;
 * the "Skip to sign in" link below exists for the still-real case of a user re-hearing the hero
 * read aloud on every single visit and wanting to jump straight past it.
 *
 * Copy is deliberately NOT mirrored from README.md's own "Why this exists" section, unlike #121's
 * first pass -- this in-app screen is meant to read as a polished product's own entry point, not a
 * GitHub README pitch (no "open source," no "self-hosted/no telemetry" infrastructure framing, no
 * arguing against other exam-prep sites). README.md keeps its own OSS-audience voice; the two are
 * intentionally decoupled now (see DOCS_MAP.md's row for this topic).
 *
 * Animation is pure CSS (`.home-hero`/`.home-form`/`.home-feature-card`/`.home-hero-glow` in
 * tokens.css), no new dependency -- matches this codebase's consistent hand-rolled-over-library
 * style elsewhere (oauth.ts, passwords.ts). Every keyframe is gated behind
 * `prefers-reduced-motion: no-preference` and kept understated on purpose: this screen is
 * permanent now, so motion that's charming on visit #1 has to still be unobtrusive on visit #100.
 */

import { AuthForm } from "./LoginGate";

interface Feature {
  title: string;
  body: string;
}

// Deliberately excludes MCP conversational quizzing (mcp-server/) -- it's a real feature, but only
// for someone running the app's own Docker container locally and pointing an MCP host at it (the
// server reads/writes the SQLite database directly over local stdio, no network path). A visitor
// to the public deployment this page is actually shown on can never use it, so advertising it here
// would be a false claim about what signing in on THIS domain gets you.
const FEATURES: Feature[] = [
  {
    title: "Timed mock exams",
    body: "Full-length, matching the real exam's question count and domain split -- flag questions, jump between them, and review your wrong answers first.",
  },
  {
    title: "Weighted readiness",
    body: "A dashboard scored against the real exam's actual domain weights, not a flat percentage -- so you always know exactly where to focus next.",
  },
  {
    title: "Practice, domain by domain",
    body: "Untimed drills, one domain at a time. Every wrong answer joins a missed-question notebook you can retry as its own focused set.",
  },
  {
    title: "Flashcards that adapt",
    body: "A quick knew-it/missed-it rating after every card biases which ones resurface first next session, so weak spots get more repetition automatically.",
  },
  {
    title: "Adaptive study plan",
    body: "A day-by-day plan that remaps itself to your actual exam date, not a fixed calendar -- compresses automatically into a prioritized checklist if your exam is close.",
  },
  {
    title: "Pacing analytics",
    body: "A per-question timing chart flags your slowest questions and links straight back to review them, benchmarked against the real exam's own time budget.",
  },
  {
    title: "Backup and reset, on your terms",
    body: "Export your entire progress as one file, restore it on another device, or wipe the slate clean for a fresh start -- always your call, never automatic.",
  },
  {
    title: "Your data stays private",
    body: "Your study activity isn't sold, tracked, or shared with anyone. It's yours, and it stays that way.",
  },
];

const featureCardStyle: React.CSSProperties = {
  background: "var(--raised)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
  padding: 20,
};

export function HomePage() {
  return (
    <div className="home-page" style={{ minHeight: "100vh", background: "var(--canvas)" }}>
      {/* Standard skip-nav pattern (WCAG 2.4.1) -- invisible until focused. A sighted user never
          sees it; a keyboard/screen-reader user gets one Tab straight to the email field instead
          of hearing/tabbing through the hero and feature cards on every single visit. */}
      <a href="#login-email" className="skip-link">
        Skip to sign in
      </a>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 24px 56px" }}>
        <div className="home-grid">
          <div className="home-hero" style={{ position: "relative" }}>
            <div className="home-hero-glow" aria-hidden="true" />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 14 }}>
              COF-C03 · SNOWPRO CORE PREP
            </div>
            <h1 style={{ margin: "0 0 16px", fontSize: 34, lineHeight: 1.2, fontWeight: 500, letterSpacing: "-0.015em", color: "var(--text-heading)" }}>
              Everything you need to pass the SnowPro Core exam.
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 520 }}>
              Timed mock exams, a readiness score weighted by the real exam&rsquo;s domain weights,
              and a study plan that adapts to your exam date &mdash; sign in to start tracking your
              progress.
            </p>
          </div>

          <div className="home-form">
            <AuthForm headingLevel="h2" />
          </div>

          {/* Its own grid item (not nested in .home-hero) so tokens.css can place it after the
              form on mobile (compact hero -> form -> screenshot -> features, minimizing scroll to
              the form a daily returning visitor needs) while keeping it directly under the hero on
              desktop, where the form has its own sticky column and scroll length isn't a concern. */}
          <img
            className="home-screenshot"
            src="/landing-dashboard.png"
            alt="Dashboard: exam countdown, weighted readiness, and today's plan tasks in one view."
          />

          <div className="home-features">
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: ".02em", color: "var(--text-dim)", margin: "8px 0 16px" }}>
              What you get once you&rsquo;re in
            </div>
            <div className="home-feature-grid">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="home-feature-card"
                  style={{ ...featureCardStyle, animationDelay: `${i * 70}ms` }}
                >
                  <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>{f.title}</h2>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)" }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
