/**
 * Hands-on setup — spec §6.11, reworked 2026-08-18 from a single flat list into two sections
 * ("Setup Steps" you actually do, in order, and "Known Issues & Fixes" for things that went
 * wrong along the way) matching the source log's own structure (see
 * pipeline/src/parsers/setupLog.ts). Each card shows the entry's one-line summary and its
 * commands. Checkable (progress.setup.checked), commands copyable.
 *
 * Issue #177 removed the per-card "Full details →" link, which deep-linked to the source markdown
 * on GitHub. This site does not present itself as having a public upstream, and an in-app link to
 * a repository is the most explicit possible contradiction of that.
 *
 * The narrative those links pointed at is genuinely useful and is currently unreachable from the
 * app: the parser tracks each entry's body line range but the bundle only carries `summary`,
 * `commands` and `sourceAnchor`, so there is nothing to render. Surfacing it in-app means emitting
 * the rendered body into ContentBundle — a shape change across three packages, tracked separately
 * rather than smuggled into an identity change.
 */

import { useState } from "react";
import { useContent } from "../lib/useContent";
import { updateProgress, useProgress } from "../lib/progress";
import type { SetupItem } from "../lib/content";

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
};

export function Setup() {
  const { content, error } = useContent();
  const progress = useProgress();

  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const toggleStep = (id: string) =>
    updateProgress((p) => ({
      ...p,
      setup: { checked: p.setup.checked.includes(id) ? p.setup.checked.filter((x) => x !== id) : [...p.setup.checked, id] },
    }));

  const steps = content.setup.filter((s) => s.kind === "step");
  const issues = content.setup.filter((s) => s.kind === "issue");
  const doneCount = content.setup.filter((s) => progress.setup.checked.includes(s.id)).length;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Hands-on setup</h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {doneCount} / {content.setup.length} done
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px", maxWidth: "50em" }}>
        Summaries only — each card links to the full walkthrough in{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>15_Hands_On_Snowflake_Setup_Log.md</code>.
      </p>

      {steps.length > 0 && (
        <>
          <div style={{ ...kicker, marginBottom: 12 }}>Setup steps</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {steps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                nested={step.group !== step.title}
                done={progress.setup.checked.includes(step.id)}
                onToggle={() => toggleStep(step.id)}
              />
            ))}
          </div>
        </>
      )}

      {issues.length > 0 && (
        <>
          <div style={{ ...kicker, color: "var(--status-warning)", marginBottom: 12 }}>Known issues &amp; fixes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {issues.map((issue) => (
              <StepCard
                key={issue.id}
                step={issue}
                nested={issue.group !== issue.title}
                done={progress.setup.checked.includes(issue.id)}
                onToggle={() => toggleStep(issue.id)}
                accent="var(--status-warning)"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      style={{ fontSize: 11, color: "var(--text-dim)", background: "transparent", border: "1px solid var(--hairline)", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function StepCard({
  step,
  nested,
  done,
  onToggle,
  accent,
}: {
  step: SetupItem;
  nested: boolean;
  done: boolean;
  onToggle: () => void;
  accent?: string;
}) {
  return (
    <div style={{ ...cardStyle, marginLeft: nested ? 28 : 0, borderLeft: accent ? `2px solid ${accent}` : cardStyle.border }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={`Mark "${step.title}" as ${done ? "done" : "not done"}`}
          style={{
            flex: "0 0 18px",
            width: 18,
            height: 18,
            marginTop: 2,
            borderRadius: 3,
            border: `1px solid ${done ? "var(--accent)" : "var(--hairline-strong)"}`,
            background: done ? "var(--accent)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "var(--canvas)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {done ? "✓" : ""}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: nested ? 14 : 15, fontWeight: 500, color: "var(--text-heading)", marginBottom: 6 }}>{step.title}</div>
          {step.summary && (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", marginBottom: step.commands.length ? 12 : 8 }}>
              {step.summary}
            </div>
          )}
          {step.commands.map((cmd, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "10px 12px", marginBottom: 8, overflowX: "auto" }}>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-body)", whiteSpace: "pre", flex: 1 }}>{cmd}</code>
              <CopyButton text={cmd} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
