/**
 * Analytics — spec §6.9. Three views, no more: score trend, per-domain bars against the pass
 * line, time per question. Neutral scale throughout; only the 750 line and out-of-range timings
 * take colour (per spec's own explicit chart-color rule — this isn't a categorical palette, so
 * no legend or hue assignment is needed beyond the one accent + one status color).
 *
 * Hand-drawn SVG/HTML, no charting library, consistent with the rest of the app and matching the
 * build order's own "hand-drawn charts" note for this step.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { useProgress, type Attempt } from "../lib/progress";
import { overallReadiness } from "../lib/readiness";
import { slowestQuestions } from "../lib/timing";
import type { ContentBundle } from "../lib/content";
import { renderInline } from "../lib/inlineMarkdown";

const PASS_LINE = 750;
const PACE_SEC = 69; // 115 min / 100 questions
// Fixed ceiling for the timing bars' scale (issue #81 design review) -- deliberately NOT
// `Math.max(...slow.map(timeSec))`. The old relative-to-this-set's-own-max scaling made the
// slowest of the 8 shown always render at 100% width regardless of whether that outlier was 90s
// or 400s, so a mildly-over-pace attempt looked exactly as alarming as a genuinely stuck one, and
// the same real time (say 150s) would paint a different-length bar depending on what else happened
// to be slow that day -- severity wasn't comparable across attempts, and the accent pace-tick
// jumped to a different position on every render instead of being a fixed, learnable reference
// point. The "Domain accuracy" chart directly above this one on the same page already uses a
// fixed 0-1000 scale with a fixed pass-line tick for the identical reason; this brings the timing
// chart in line with that. ~4.3x PACE_SEC: generous enough that a normal over-pace question (say
// 120-180s) still reads as a partial, non-maxed bar, high enough that only a genuinely stalled
// question clips. A bar beyond this clips at 100% width with a square-cut trailing edge (vs. the
// rounded edge of a bar showing its true length) rather than rescaling the whole chart around one
// outlier -- the `{timeSec}s` label next to every bar stays exact regardless, so no information is
// lost, only the bar's role narrows to "coarse severity at a glance," not fine-grained comparison.
const TIME_SCALE_MAX_SEC = 300;

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--radius-card)",
  padding: 20,
};

const kicker: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: 14,
};

export function Analytics() {
  const { content, error } = useContent();
  const progress = useProgress();

  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const readiness = overallReadiness(content, progress.attempts);
  const slow = slowestQuestions(content, progress.attempts);

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Analytics</h1>

      <div style={cardStyle}>
        <div style={kicker}>Score trend</div>
        <ScoreTrend attempts={progress.attempts} currentBankVersion={content.bankVersion} />
      </div>

      <div style={cardStyle}>
        <div style={kicker}>Domain accuracy vs. pass line</div>
        {progress.attempts.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No attempts yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {readiness.perDomain.map((d) => {
              const domain = content.domains.find((cd) => cd.id === d.domainId);
              return (
                <div key={d.domainId}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-body)", marginBottom: 6 }}>
                    <span>
                      D{domain?.number} {domain?.title}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-heading)" }}>
                      {d.scaled ?? "—"}
                      <span style={{ color: "var(--text-dim)", fontSize: 11 }}> / 1000</span>
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 6, background: "var(--hairline)", borderRadius: 3 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${d.scaled ? d.scaled / 10 : 0}%`, background: "var(--text-body)", borderRadius: 3 }} />
                    <div style={{ position: "absolute", left: `${PASS_LINE / 10}%`, top: -3, width: 1, height: 12, background: "var(--accent)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={kicker}>Time per question</div>
        <TimingView content={content} slow={slow} />
      </div>
    </div>
  );
}

function ScoreTrend({ attempts, currentBankVersion }: { attempts: Attempt[]; currentBankVersion: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...attempts].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  if (sorted.length < 2) {
    return <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Appears once you've taken two attempts.</div>;
  }

  const W = 600;
  const H = 150;
  const padL = 34;
  const padR = 10;
  const padT = 14;
  const padB = 10;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xFor = (i: number) => padL + (i / (sorted.length - 1)) * innerW;
  const yFor = (score: number) => padT + innerH - (score / 1000) * innerH;
  const points = sorted.map((a, i) => ({ attempt: a, x: xFor(i), y: yFor(a.scaled) }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const passY = yFor(PASS_LINE);
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
        <line x1={padL} y1={passY} x2={W - padR} y2={passY} stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" />
        <text x={padL} y={passY - 5} fontSize={9} fontFamily="var(--font-mono)" fill="var(--accent)">
          750
        </text>
        <text x={0} y={padT + 4} fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-dim)">
          1000
        </text>
        <text x={8} y={padT + innerH} fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-dim)">
          0
        </text>
        <path d={path} fill="none" stroke="var(--text-body)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const isOldBank = p.attempt.bankVersion !== currentBankVersion;
          return (
            <circle
              key={p.attempt.id}
              cx={p.x}
              cy={p.y}
              r={hover === i ? 6 : 4}
              fill={isOldBank ? "var(--card)" : "var(--text-body)"}
              stroke="var(--text-body)"
              strokeWidth={isOldBank ? 2 : 0}
              tabIndex={0}
              role="img"
              aria-label={`${p.attempt.scaled} out of 1000, ${new Date(p.attempt.submittedAt).toLocaleDateString()}${isOldBank ? ", older content version" : ""}`}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((h) => (h === i ? null : h))}
            />
          );
        })}
      </svg>
      {hovered && (
        <div
          style={{
            position: "absolute",
            left: `${(hovered.x / W) * 100}%`,
            top: 0,
            transform: "translate(-50%, -100%)",
            background: "var(--raised)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono)" }}>{hovered.attempt.scaled} / 1000</div>
          <div style={{ color: "var(--text-dim)", fontSize: 11 }}>{new Date(hovered.attempt.submittedAt).toLocaleDateString()}</div>
          {hovered.attempt.bankVersion !== currentBankVersion && <div style={{ color: "var(--status-warning)", fontSize: 11 }}>older content version</div>}
        </div>
      )}
    </div>
  );
}

function TimingView({ content, slow }: { content: ContentBundle; slow: ReturnType<typeof slowestQuestions> }) {
  if (slow.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No timing data yet.</div>;
  }

  const anyClipped = slow.some((s) => s.timeSec > TIME_SCALE_MAX_SEC);
  const paceTickPct = (PACE_SEC / TIME_SCALE_MAX_SEC) * 100;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 14, lineHeight: 1.5 }}>
        Pace for a 115-min, 100-question exam:{" "}
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-body)" }}>{PACE_SEC}s</span> per question (accent tick below). Every
        question you've attempted (Practice or Mock) — <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-body)" }}>{slow.length}</span>{" "}
        so far, most recent time if you retook it, slowest first. Bars use a fixed 0–{Math.round(TIME_SCALE_MAX_SEC / 60)}-min scale so severity is
        comparable across attempts{anyClipped ? " — a bar cut off at the end means the real time was even higher, see the exact number" : ""}.
      </div>
      <div style={{ maxHeight: "50vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 6 }}>
        {slow.map((s) => {
          const overPace = s.timeSec > PACE_SEC;
          const clipped = s.timeSec > TIME_SCALE_MAX_SEC;
          const pct = Math.min(100, (s.timeSec / TIME_SCALE_MAX_SEC) * 100);
          const domain = content.domains.find((d) => d.id === s.domainId);
          return (
            <Link key={`${s.questionId}-${s.attemptId}`} to={`/results/${s.attemptId}#question-${s.questionId}`} style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, fontSize: 12, marginBottom: 6 }}>
                <span className="inline-md" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {renderInline(s.stem)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: overPace ? "var(--status-warning)" : "var(--text-dim)", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {s.timeSec}s · D{domain?.number}
                </span>
              </div>
              <div style={{ position: "relative", height: 6, background: "var(--hairline)", borderRadius: 3 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: overPace ? "var(--status-warning)" : "var(--text-body)",
                    borderRadius: clipped ? "3px 0 0 3px" : 3,
                  }}
                />
                <div style={{ position: "absolute", left: `${paceTickPct}%`, top: -3, width: 1, height: 12, background: "var(--accent)" }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
