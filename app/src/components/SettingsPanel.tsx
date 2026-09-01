/**
 * Settings — an Appearance (Light/Dark) control, progress backup/restore, and reset all
 * progress behind a typed confirmation. Deliberately does NOT have an exam-date field — that used
 * to live here too, duplicating the Dashboard Exam card's own date picker for no reason (a bare
 * date input is nearly meaningless without the
 * days-left countdown right next to it, which only Dashboard has). Removed after a UX pass;
 * Dashboard is the one place to set it now. Mounted once at the App root (see CommandPalette's
 * own doc comment for the same pattern) and driven by settingsStore rather than parent-owned
 * state, so it can coordinate with the ⌘K palette — the two are mutually exclusive full-screen
 * overlays and each closes the other on open.
 */

import { useEffect, useRef, useState } from "react";
import { getProgress, getStorageBackend, resetProgress, updateProgress, useProgress, type ProgressState } from "../lib/progress";
import { isoDate } from "../lib/planDates";
import { closeSettings, useSettingsOpen } from "../lib/settingsStore";
import { changePassword, logout, setInitialPassword, useSessionUser } from "../lib/session";
import { PasswordInput } from "./PasswordInput";

const RESET_PHRASE = "RESET";
// Mirrors LoginGate.tsx's own copy of this constant and pipeline/src/passwords.ts's
// MIN_PASSWORD_LENGTH -- client-side is just an early check, the server re-validates regardless.
const MIN_PASSWORD_LENGTH = 8;

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

// "System" was dropped from the UI on request -- the underlying "system" theme value and its
// prefers-color-scheme handling in theme.ts/tokens.css are untouched, so a record that already has
// settings.theme: "system" persisted keeps resolving correctly; a user just can't pick it here.
const THEME_OPTIONS: { value: ProgressState["settings"]["theme"]; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Same visual pattern as Practice.tsx's FilterTab (inactive = transparent + muted label, active
 *  = --raised + heading label), just equal-width for a 3-segment row instead of Practice's
 *  content-width tabs — this file's own Export/Import row already uses the equal-width shape. */
function ThemeTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 0",
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

export function SettingsPanel() {
  const open = useSettingsOpen();
  const { settings } = useProgress();
  const me = useSessionUser();
  const [resetInput, setResetInput] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Issue #46: "Set a password" for a legacy pre-#46 account (me.hasPassword false, no current
  // password needed -- the live session already proves ownership) or "Change password" for one
  // that already has it (requires the current password, so a moment of unattended device access
  // can't silently take it over).
  const savePassword = async () => {
    setPwMessage(null);
    if (newPasswordInput.length < MIN_PASSWORD_LENGTH) {
      setPwMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPwMessage("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    const result = me?.hasPassword
      ? await changePassword(currentPasswordInput, newPasswordInput)
      : await setInitialPassword(newPasswordInput);
    setPwSaving(false);
    if (result.ok) {
      setPwMessage(me?.hasPassword ? "Password changed." : "Password set — this account is now protected.");
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setPwOpen(false);
    } else {
      setPwMessage(result.error);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await logout();
    // A full reload, not a React state transition -- see session.ts's logout() doc comment: this
    // is what resets progress.ts's own in-memory state so a shared machine's next person doesn't
    // see this person's cached data for a moment before the gate screen appears.
    window.location.reload();
  };

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
    // Opens bottom-left, next to the Settings button that triggers it (Sidebar.tsx) rather than
    // the generic top-right corner every other full-screen overlay in this app defaults to --
    // unlike CommandPalette (triggerable from anywhere via ⌘K, so no single "near the trigger"
    // position makes sense for it), Settings has exactly one fixed, always-visible trigger, so
    // anchoring near it keeps the spatial connection between click and result.
    <div onClick={closeSettings} style={{ position: "fixed", inset: 0, background: "var(--scrim)", display: "flex", alignItems: "flex-end", justifyContent: "flex-start", padding: 16, zIndex: 60 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 320, background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 20, boxShadow: "var(--overlay-shadow)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-heading)" }}>Settings</span>
          <button ref={closeButtonRef} type="button" onClick={closeSettings} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" }}>
            ✕
          </button>
        </div>

        {me && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Profile</label>
            {/* Both read-only — name and email are shown so someone who forgets which identity
                they're signed in as can check, but neither is user-editable in this app: email is
                the identity/lookup key (server.ts's normalizeEmail()), and name-editing (issue
                #41's original design) was deliberately removed rather than kept as a stray
                affordance — see DOCS_MAP.md/CLAUDE.md for the removal. */}
            <div style={{ fontSize: 14, color: "var(--text-body)", marginBottom: 2 }}>{me.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{me.email}</div>
            <button
              type="button"
              disabled={signingOut}
              onClick={signOut}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                color: "var(--text-muted)",
                fontSize: 13,
                padding: "9px 0",
                cursor: signingOut ? "default" : "pointer",
              }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>

            <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 14, paddingTop: 14 }}>
              {!pwOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setPwOpen(true);
                    setPwMessage(null);
                  }}
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-muted)", fontSize: 13, padding: "9px 0", cursor: "pointer" }}
                >
                  {me.hasPassword ? "Change password" : "Set a password"}
                </button>
              )}
              {pwOpen && (
                <>
                  {!me.hasPassword && (
                    <p style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
                      This account doesn&rsquo;t have a password yet — set one to keep others on
                      this network from opening it. There&rsquo;s no self-service reset in this
                      app; if you forget it, ask the app operator.
                    </p>
                  )}
                  {me.hasPassword && (
                    <PasswordInput
                      autoComplete="current-password"
                      placeholder="Current password"
                      value={currentPasswordInput}
                      onChange={setCurrentPasswordInput}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "8px 10px", minHeight: 36, marginBottom: 8 }}
                    />
                  )}
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`}
                    value={newPasswordInput}
                    onChange={setNewPasswordInput}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "8px 10px", minHeight: 36, marginBottom: 8 }}
                  />
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmPasswordInput}
                    onChange={setConfirmPasswordInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePassword();
                    }}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "8px 10px", minHeight: 36, marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      disabled={pwSaving}
                      onClick={savePassword}
                      style={{ flex: 1, background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "8px 0", cursor: pwSaving ? "default" : "pointer" }}
                    >
                      {pwSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPwOpen(false);
                        setPwMessage(null);
                        setCurrentPasswordInput("");
                        setNewPasswordInput("");
                        setConfirmPasswordInput("");
                      }}
                      style={{ flex: 1, background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-muted)", fontSize: 13, padding: "8px 0", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {pwMessage && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{pwMessage}</div>}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Appearance</label>
          <div style={{ display: "flex", gap: 8 }}>
            {THEME_OPTIONS.map((opt) => (
              <ThemeTab
                key={opt.value}
                label={opt.label}
                active={settings.theme === opt.value}
                onClick={() => updateProgress((prev) => ({ ...prev, settings: { ...prev.settings, theme: opt.value } }))}
              />
            ))}
          </div>
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
              color: resetInput === RESET_PHRASE ? "var(--canvas)" : "var(--text-dim)",
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
        </div>
      </div>
    </div>
  );
}
