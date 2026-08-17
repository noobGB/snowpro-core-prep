/**
 * Settings — spec §6.12: exam date, a light-mode switch (present but stubbed for later), reset
 * all progress behind a typed confirmation, and a read-only content-version line.
 */

import { useState } from "react";
import { useContent } from "../lib/useContent";
import { getStorageBackend, resetProgress, updateProgress, useProgress } from "../lib/progress";

const DEFAULT_EXAM_DATE = "2026-08-19";
const RESET_PHRASE = "RESET";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { content } = useContent();
  const progress = useProgress();
  const [resetInput, setResetInput] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const examDate = progress.examDate ?? DEFAULT_EXAM_DATE;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,5,6,.6)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 16, zIndex: 60 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 320, background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>Settings</span>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" }}>
            ✕
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Exam date</label>
        <input
          type="date"
          value={examDate}
          onChange={(e) => updateProgress((p) => ({ ...p, examDate: e.target.value }))}
          style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "7px 10px", minHeight: 36, marginBottom: 18 }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: "var(--text-body)" }}>Light mode</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", border: "1px solid var(--hairline)", borderRadius: 4, padding: "2px 6px" }}>
            coming later
          </span>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16, marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--status-incorrect)", marginBottom: 6 }}>
            Reset all progress — type {RESET_PHRASE} to confirm
          </label>
          <input
            type="text"
            value={resetInput}
            onChange={(e) => setResetInput(e.target.value)}
            placeholder={RESET_PHRASE}
            style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "7px 10px", minHeight: 36, marginBottom: 8 }}
          />
          <button
            type="button"
            disabled={resetInput !== RESET_PHRASE}
            onClick={() => {
              resetProgress();
              setResetDone(true);
              setResetInput("");
            }}
            style={{
              width: "100%",
              background: resetInput === RESET_PHRASE ? "var(--status-incorrect)" : "var(--hairline)",
              color: resetInput === RESET_PHRASE ? "#08090a" : "var(--text-dim)",
              border: "none",
              borderRadius: 6,
              padding: "9px 0",
              fontSize: 13,
              fontWeight: 500,
              cursor: resetInput === RESET_PHRASE ? "pointer" : "not-allowed",
            }}
          >
            {resetDone ? "Progress reset" : "Reset everything"}
          </button>
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
          store: {getStorageBackend() === "http" ? "container (/data)" : "browser (localStorage)"}
          <br />
          {content ? (
            <>
              content {content.bankVersion.slice(0, 15)}…
              <br />
              generated {new Date(content.generatedAt).toLocaleString()}
            </>
          ) : (
            "content not loaded"
          )}
        </div>
      </div>
    </div>
  );
}
