/**
 * Settings — a light-mode switch (present but stubbed for later), progress backup/restore, reset
 * all progress behind a typed confirmation, and a read-only content-version line. Deliberately
 * does NOT have an exam-date field — that used to live here too, duplicating the Dashboard Exam
 * card's own date picker for no reason (a bare date input is nearly meaningless without the
 * days-left countdown right next to it, which only Dashboard has). Removed after a UX pass;
 * Dashboard is the one place to set it now. Mounted once at the App root (see CommandPalette's
 * own doc comment for the same pattern) and driven by settingsStore rather than parent-owned
 * state, so it can coordinate with the ⌘K palette — the two are mutually exclusive full-screen
 * overlays and each closes the other on open.
 */

import { useEffect, useRef, useState } from "react";
import { useContent } from "../lib/useContent";
import { getProgress, getStorageBackend, resetProgress, updateProgress, type ProgressState } from "../lib/progress";
import { isoDate } from "../lib/planDates";
import { closeSettings, useSettingsOpen } from "../lib/settingsStore";

const RESET_PHRASE = "RESET";

/** A loose but real check — enough to reject an unrelated JSON file without hand-writing a full
 *  schema validator for what's still just a local backup/restore feature. */
function looksLikeProgressState(value: unknown): value is ProgressState {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).schemaVersion === 1 &&
    Array.isArray((value as Record<string, unknown>).attempts)
  );
}

export function SettingsPanel() {
  const open = useSettingsOpen();
  const { content } = useContent();
  const [resetInput, setResetInput] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(getProgress(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snowprep-progress-${isoDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!looksLikeProgressState(parsed)) throw new Error("not a recognized progress file");
      updateProgress(() => parsed);
      setImportMessage("Imported — this replaced your current progress.");
    } catch {
      setImportMessage("That file doesn't look like a SnowPro Core Prep progress export.");
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Move focus into the panel on open — without this, focus stays on the Sidebar's trigger
  // button and the next Tab press lands on whatever's next in the underlying page's DOM order
  // (e.g. Dashboard's exam-date input), which is visually behind this panel's backdrop. Matches
  // CommandPalette's own "grab focus into the overlay on open" pattern (its `inputRef.current
  // ?.focus()`), just landing on the close button here since there's no search input to focus.
  useEffect(() => {
    if (open) requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <div onClick={closeSettings} style={{ position: "fixed", inset: 0, background: "rgba(5,5,6,.6)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 16, zIndex: 60 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 320, background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>Settings</span>
          <button ref={closeButtonRef} type="button" onClick={closeSettings} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" }}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: "var(--text-body)" }}>Light mode</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", border: "1px solid var(--hairline)", borderRadius: 4, padding: "2px 6px" }}>
            coming later
          </span>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16, marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
            Backup
            {getStorageBackend() === "localStorage" && " — this browser is the only copy"}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={exportProgress}
              style={{ flex: 1, background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "9px 0", cursor: "pointer" }}
            >
              Export
            </button>
            <label
              style={{ flex: 1, textAlign: "center", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "9px 0", cursor: "pointer" }}
            >
              Import
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importProgress(file);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
          </div>
          {importMessage && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>{importMessage}</div>}
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

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {getStorageBackend() === "http"
              ? "Progress is saved to this server — it survives clearing browser data."
              : "Progress is saved in this browser only — clearing site data will erase it."}
          </div>
          {content && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 8 }}>
              content v{content.bankVersion.replace(/^sha256:/, "").slice(0, 8)} · updated{" "}
              {new Date(content.generatedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
