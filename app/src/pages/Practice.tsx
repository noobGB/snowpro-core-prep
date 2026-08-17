/**
 * Practice — spec §6.3. One card per domain (question count, weight, last score, when last
 * attempted) plus a wrong-answer notebook behind a filter toggle. Starting a set always runs the
 * whole set untimed with no configuration step. The notebook's "Retry these" starts a session
 * from the filtered question list via Runner's ad-hoc "retry" set (see Runner.tsx).
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { useProgress } from "../lib/progress";
import { buildMissedIndex, type MissedEntry } from "../lib/missed";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--radius-card)",
  padding: 20,
  textAlign: "left",
  cursor: "pointer",
};

function relativeDate(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function Practice() {
  const { content, error } = useContent();
  const progress = useProgress();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "missed">("all");
  const [showEverMissed, setShowEverMissed] = useState(false);

  const missedIndex = useMemo(
    () => (content ? buildMissedIndex(content, progress.attempts) : []),
    [content, progress.attempts],
  );

  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const domainSets = content.sets.filter((s) => s.kind === "domain");
  const missedCount = missedIndex.filter((m) => m.currentlyMissed).length;
  const visibleMissed = missedIndex.filter((m) => (showEverMissed ? m.everMissed : m.currentlyMissed));

  const lastAttemptFor = (setId: string) =>
    [...progress.attempts].filter((a) => a.setId === setId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];

  const retryMissed = () => {
    navigate("/session/retry", { state: { questionIds: visibleMissed.map((m) => m.question.id) } });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Practice</h1>
        <div style={{ display: "flex", gap: 6 }}>
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="All sets" />
          <FilterTab active={filter === "missed"} onClick={() => setFilter("missed")} label={`Questions I missed (${missedCount})`} />
        </div>
      </div>

      {filter === "all" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {domainSets.map((set) => {
            const domain = content.domains.find((d) => d.id === set.domainId);
            const last = lastAttemptFor(set.id);
            return (
              <button key={set.id} type="button" style={cardStyle} onClick={() => navigate(`/session/${set.id}`)}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>D{domain?.number}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", background: "rgba(255,255,255,.05)", borderRadius: 4, padding: "1px 6px" }}>
                    {domain ? Math.round(domain.weight * 100) : 0}%
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)", marginBottom: 6 }}>{domain?.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{set.questionIds.length} questions</div>
                {last ? (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-body)" }}>
                    last {last.scaled} <span style={{ color: "var(--text-dim)" }}>· {relativeDate(last.submittedAt)}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Not attempted yet</div>
                )}
              </button>
            );
          })}
          <button
            key="missed"
            type="button"
            style={{ ...cardStyle, border: "1px dashed var(--hairline)" }}
            onClick={() => setFilter("missed")}
          >
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)", marginBottom: 6 }}>Missed</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{missedCount} question{missedCount === 1 ? "" : "s"}</div>
          </button>
        </div>
      ) : (
        <MissedNotebook
          entries={visibleMissed}
          showEverMissed={showEverMissed}
          onToggleShowEverMissed={() => setShowEverMissed((s) => !s)}
          onRetry={retryMissed}
        />
      )}
    </div>
  );
}

function FilterTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        minHeight: 36,
        border: "1px solid var(--hairline)",
        borderRadius: 6,
        background: active ? "var(--raised)" : "transparent",
        color: active ? "var(--text-heading)" : "var(--text-muted)",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function MissedNotebook({
  entries,
  showEverMissed,
  onToggleShowEverMissed,
  onRetry,
}: {
  entries: MissedEntry[];
  showEverMissed: boolean;
  onToggleShowEverMissed: () => void;
  onRetry: () => void;
}) {
  const { content } = useContent();
  if (entries.length === 0) {
    return <div style={{ color: "var(--text-dim)", fontSize: 14 }}>Nothing missed{showEverMissed ? "" : " right now"}.</div>;
  }

  const byDomain = new Map<string, MissedEntry[]>();
  for (const e of entries) {
    const list = byDomain.get(e.question.domainId) ?? [];
    list.push(e);
    byDomain.set(e.question.domainId, list);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={showEverMissed} onChange={onToggleShowEverMissed} />
          Show everything ever missed (including since fixed)
        </label>
        <button
          type="button"
          onClick={onRetry}
          style={{ background: "var(--accent)", color: "var(--canvas)", border: "none", borderRadius: 6, padding: "9px 16px", minHeight: 40, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          Retry these ({entries.length})
        </button>
      </div>

      {[...byDomain.entries()].map(([domainId, list]) => (
        <div key={domainId} style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
            {content?.domains.find((d) => d.id === domainId)?.title ?? domainId}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map((e) => (
              <MissedCard key={e.question.id} entry={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MissedCard({ entry }: { entry: MissedEntry }) {
  const { question, mostRecentAnswer, currentlyMissed } = entry;
  return (
    <div style={{ background: "var(--card)", border: `1px solid ${currentlyMissed ? "var(--status-incorrect)" : "var(--hairline)"}`, borderRadius: "var(--radius-card)", padding: 20 }}>
      {!currentlyMissed && (
        <div style={{ fontSize: 11, color: "var(--status-correct)", marginBottom: 8 }}>Since answered correctly</div>
      )}
      <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-body)", marginBottom: 12 }}>{question.stem}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
        You picked: {mostRecentAnswer.picked.length > 0 ? mostRecentAnswer.picked.join(", ") : "(nothing)"} · Correct:{" "}
        <span style={{ color: "var(--status-correct)" }}>{question.correct.join(", ")}</span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", margin: "0 0 10px" }}>{question.explanation}</p>
      <Link to={`/notes/${question.domainId}`} style={{ fontSize: 12 }}>
        Read the note →
      </Link>
    </div>
  );
}
