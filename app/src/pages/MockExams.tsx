/**
 * Mock exams — spec §6.6. A list of every mock the pipeline found, in series order (Mock 1
 * first — they're a deliberate difficulty progression, e.g. Mock 5 is written to be the hardest
 * and fully original, meant to be taken last), with question count, domain split, and attempt
 * history. Starting one is deliberate: the actual "states the rules before the clock begins"
 * confirmation already lives in Runner.tsx's own pre-start gate (spec frames that as part of the
 * runner's strict-timer behavior, not this list screen) — this page's job is the index, attempt
 * history, and the "resume, blocks a second one" in-progress handling.
 */

import { Link } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { useProgress } from "../lib/progress";

function relativeDate(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function remainingLabel(startedAt: string, durationMin: number): string {
  const remainingSec = Math.max(0, durationMin * 60 - Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(remainingSec / 60);
  return `${m} minute${m === 1 ? "" : "s"} left`;
}

export function MockExams() {
  const { content, error } = useContent();
  const progress = useProgress();

  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const mockSets = [...content.sets.filter((s) => s.kind === "mock")].sort((a, b) => a.id.localeCompare(b.id));
  const inProgressMock = progress.inProgress?.kind === "mock" ? progress.inProgress : null;

  // A mock's clock runs off its own startedAt with no server-side keepalive -- Runner.tsx only
  // auto-finalizes an expired session while that session's own page is actually mounted, so
  // navigating away before that fires can leave inProgress pointing at a session whose time is
  // already up. Once that's true, stop treating it as blocking: it isn't a real in-progress
  // attempt with answers left to lose anymore. The stale slot still gets cleared for real the
  // moment its own card is opened (Runner re-checks and finalizes immediately on mount) -- this
  // only stops it from blocking every OTHER mock in the meantime.
  const blockingMockExpired = (() => {
    if (!inProgressMock) return false;
    const blockingSet = mockSets.find((s) => s.id === inProgressMock.setId);
    const durationMin = blockingSet?.durationMin ?? 115;
    const elapsedMs = Date.now() - new Date(inProgressMock.startedAt).getTime();
    return elapsedMs >= durationMin * 60 * 1000;
  })();

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>
        Mock exams
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        {mockSets[0]?.durationMin ?? 115} min · no pause
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mockSets.map((set) => {
          const attempts = [...progress.attempts]
            .filter((a) => a.setId === set.id)
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
          const isThisResumable = inProgressMock?.setId === set.id;
          const blockedByOtherMock = inProgressMock && inProgressMock.setId !== set.id && !blockingMockExpired;
          const split = set.domainSplit
            ? content.domains.map((d) => set.domainSplit![d.id] ?? 0).join("/")
            : null;

          return (
            <div key={set.id} style={{ background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-heading)", marginBottom: 6 }}>{set.title}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                    {set.questionIds.length}Q{split ? ` · ${split}` : ""}
                  </div>
                </div>
                {isThisResumable ? (
                  <Link
                    to={`/session/${set.id}`}
                    style={{ display: "inline-flex", alignItems: "center", background: "var(--accent)", color: "var(--canvas)", borderRadius: 6, padding: "9px 16px", minHeight: 40, fontSize: 13, fontWeight: 500 }}
                  >
                    Resume — {remainingLabel(inProgressMock.startedAt, set.durationMin ?? 115)}
                  </Link>
                ) : blockedByOtherMock ? (
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Finish your other mock first</span>
                ) : (
                  <Link
                    to={`/session/${set.id}`}
                    style={{ display: "inline-flex", alignItems: "center", background: "var(--accent)", color: "var(--canvas)", borderRadius: 6, padding: "9px 16px", minHeight: 40, fontSize: 13, fontWeight: 500 }}
                  >
                    Start
                  </Link>
                )}
              </div>

              {attempts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--hairline-faint)" }}>
                  {attempts.map((a) => (
                    <Link
                      key={a.id}
                      to={`/results/${a.id}`}
                      style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>
                        {a.status} · {relativeDate(a.submittedAt)}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-heading)" }}>{a.scaled}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
