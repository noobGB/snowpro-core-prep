/**
 * Hands-on setup — spec §6.11. Steps numbered continuously across groups (not restarting per
 * group), checkable (progress.setup.checked), commands copyable, gotchas collapsed under their
 * step. `body` is raw markdown text (the pipeline deliberately keeps it byte-faithful rather than
 * re-rendering it) — shown as preformatted text for now rather than full markdown rendering, the
 * same known simplification as question stems elsewhere in the app.
 */

import { useState } from "react";
import { useContent } from "../lib/useContent";
import { updateProgress, useProgress } from "../lib/progress";
import type { SetupItem } from "../lib/content";

/** `step.body` is the full raw markdown for the step, which includes the same fenced code blocks
 *  already extracted separately into `step.commands` (with their own copy button) — strip the
 *  fences back out of the displayed prose so a command doesn't render twice. */
function stripFencedCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

  const doneCount = content.setup.filter((s) => progress.setup.checked.includes(s.id)).length;
  let lastGroup: string | null = null;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Hands-on setup</h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {doneCount} / {content.setup.length} steps done
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {content.setup.map((step, i) => {
          const showGroupHeader = step.group !== lastGroup;
          lastGroup = step.group;
          return (
            <div key={step.id}>
              {showGroupHeader && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", margin: "20px 0 10px" }}>
                  {step.group}
                </div>
              )}
              <StepCard number={i + 1} step={step} done={progress.setup.checked.includes(step.id)} onToggle={() => toggleStep(step.id)} />
            </div>
          );
        })}
      </div>
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

function StepCard({ number, step, done, onToggle }: { number: number; step: SetupItem; done: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={onToggle}
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>{number}.</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>{step.title}</span>
          </div>
          {(() => {
            const proseBody = stripFencedCode(step.body);
            return proseBody ? (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", whiteSpace: "pre-wrap", marginBottom: step.commands.length || step.gotchas.length ? 12 : 0 }}>
                {proseBody}
              </div>
            ) : null;
          })()}
          {step.commands.map((cmd, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "10px 12px", marginBottom: 8, overflowX: "auto" }}>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-body)", whiteSpace: "pre", flex: 1 }}>{cmd}</code>
              <CopyButton text={cmd} />
            </div>
          ))}
          {step.gotchas.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--status-warning)" }}>
                {step.gotchas.length} gotcha{step.gotchas.length === 1 ? "" : "s"}
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {step.gotchas.map((g, i) => (
                  <div key={i} style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", borderLeft: "2px solid var(--status-warning)", paddingLeft: 10 }}>
                    {g}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
