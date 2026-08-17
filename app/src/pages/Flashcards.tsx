/**
 * Flashcards — spec §6.7. One card at a time, click or space to flip, arrow keys to move. No
 * grading, no scheduling. Order is shuffled once per session (mount) — a fixed shuffle of the
 * whole deck that the domain filter then narrows, so switching filters doesn't reshuffle.
 * Position (`progress.flashcards.lastIndex`) is remembered per the deck currently in view.
 */

import { useEffect, useMemo, useState } from "react";
import { useContent } from "../lib/useContent";
import { updateProgress, useProgress } from "../lib/progress";
import type { Flashcard } from "../lib/content";

const DECKS = ["All", "D1", "D2", "D3", "D4", "D5"] as const;
type Deck = (typeof DECKS)[number];

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function Flashcards() {
  const { content, error } = useContent();
  const progress = useProgress();
  const [deck, setDeck] = useState<Deck>("All");
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // One fixed shuffle per mount ("per session"); domain filtering narrows this same order.
  const sessionOrder = useMemo(() => (content ? shuffled(content.flashcards) : []), [content]);

  const pool = useMemo(
    () => (deck === "All" ? sessionOrder : sessionOrder.filter((c) => c.domainId?.toUpperCase() === deck)),
    [sessionOrder, deck],
  );

  useEffect(() => {
    setI(Math.min(progress.flashcards.lastIndex, Math.max(0, pool.length - 1)));
    setFlipped(false);
    // Only seed from stored position once, when the pool first becomes available — deck
    // switches below manage their own index reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length > 0]);

  const step = (delta: number) => {
    if (pool.length === 0) return;
    setI((prev) => (prev + delta + pool.length) % pool.length);
    setFlipped(false);
  };

  // Persisting to the progress store here (rather than inside setI's updater above) keeps the
  // write out of React's render phase — calling updateProgress synchronously from within a
  // setState updater trips "Cannot update a component while rendering a different component,"
  // since updateProgress's subscriber notification is itself a synchronous state update.
  useEffect(() => {
    const card = pool[i];
    if (!card) return;
    updateProgress((p) => ({
      ...p,
      flashcards: { lastIndex: i, seen: p.flashcards.seen.includes(card.id) ? p.flashcards.seen : [...p.flashcards.seen, card.id] },
    }));
  }, [i, pool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        step(1);
      } else if (e.key === "ArrowLeft") {
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const card: Flashcard | undefined = pool[Math.min(i, pool.length - 1)];
  const face = card ? (flipped ? card.back : card.front) : "";
  const faceSize = flipped ? 26 : 32;
  const faceLabel = card ? `${flipped ? "Answer" : "Prompt"} · ${(card.domainId ?? "—").toUpperCase()}` : "";

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 10 }}>
        From the cheatsheet · hard numbers only
      </div>
      <h1 style={{ margin: "0 0 24px", fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Flashcards</h1>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DECKS.map((d) => {
            const n = d === "All" ? sessionOrder.length : sessionOrder.filter((c) => c.domainId?.toUpperCase() === d).length;
            const active = d === deck;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDeck(d);
                  setI(0);
                  setFlipped(false);
                }}
                style={{
                  padding: "7px 12px",
                  minHeight: 38,
                  border: `1px solid ${active ? "var(--accent)" : "var(--hairline)"}`,
                  background: active ? "var(--raised)" : "transparent",
                  color: active ? "var(--text-heading)" : "var(--text-muted)",
                  borderRadius: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {d} · {n}
              </button>
            );
          })}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {pool.length > 0 ? `${i + 1} / ${pool.length}` : "0 / 0"}
        </span>
      </div>

      {card ? (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            style={{
              width: "100%",
              minHeight: 320,
              background: "var(--card)",
              border: `1px solid ${flipped ? "var(--accent)" : "var(--hairline)"}`,
              borderRadius: "var(--radius-card)",
              padding: "48px 40px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-dim)" }}>{faceLabel}</span>
            <span key={`${card.id}-${flipped}`} className="flashcard-face" style={{ fontSize: faceSize, lineHeight: 1.35, fontWeight: 400, color: "var(--text-heading)", letterSpacing: "-0.014em", maxWidth: "22ch" }}>
              {face}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>{flipped ? "click to hide" : "click to reveal"}</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
            <button type="button" onClick={() => step(-1)} style={{ flex: 1, minHeight: 48, background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 14, cursor: "pointer" }}>
              ← Previous
            </button>
            <button type="button" onClick={() => step(1)} style={{ flex: 1, minHeight: 48, background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 14, cursor: "pointer" }}>
              Next →
            </button>
          </div>

          <div style={{ display: "flex", gap: 3, marginTop: 20 }}>
            {pool.map((c, n) => (
              <div key={c.id} style={{ flex: 1, height: 3, borderRadius: 2, background: n === i ? "var(--accent)" : n < i ? "var(--hairline-strong)" : "var(--hairline-faint)" }} />
            ))}
          </div>

          <p style={{ margin: "22px 0 0", fontSize: 13, lineHeight: 1.65, color: "var(--text-dim)", maxWidth: "40em" }}>
            Click the card or press space to flip; arrow keys move. Position is remembered, so the deck resumes where you stopped. No grading — these are for rehearsal, not assessment.
          </p>
        </>
      ) : (
        <div style={{ color: "var(--text-dim)" }}>No cards in this deck.</div>
      )}
    </div>
  );
}
