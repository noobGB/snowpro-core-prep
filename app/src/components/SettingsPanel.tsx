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
import { getProgress, getStorageBackend, resetProgressConfirmed, updateProgress, useProgress, type ProgressState } from "../lib/progress";
import { isoDate } from "../lib/planDates";
import { closeSettings, useSettingsIntent, useSettingsOpen } from "../lib/settingsStore";
import { changePassword, deleteAccount, DELETE_CONFIRM_PHRASE, logout, setInitialPassword, upgradeToAccount, useSessionUser } from "../lib/session";
import { PasswordInput } from "./PasswordInput";
import { SiteFooter } from "./SiteFooter";

const RESET_PHRASE = "RESET";
// Mirrors LoginGate.tsx's own copy of this constant and pipeline/src/passwords.ts's
// MIN_PASSWORD_LENGTH -- client-side is just an early check, the server re-validates regardless.
const MIN_PASSWORD_LENGTH = 8;
// Same pattern LoginGate.tsx and server.ts's POST /api/session both use -- kept identical rather
// than relying on the browser's looser native type="email" validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const panelLabelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 };

const panelInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--card)",
  border: "1px solid var(--hairline)",
  borderRadius: 6,
  color: "var(--text-body)",
  fontSize: 13,
  padding: "8px 10px",
  minHeight: 36,
};

const fieldLabelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 };

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

/**
 * The Account section for a demo guest — a conversion surface, not an account-details readout.
 *
 * Everything the normal Account section shows is wrong here and was actively harmful before this:
 *  - The email. A guest's address is a generated `guest-<32 hex>@guest.invalid` (db.ts's
 *    `createGuestUser`). It is an internal key, not an identity, and showing it to the one user
 *    who cannot act on it is machine noise wrapped across two lines of a 320px panel.
 *  - "Change password". A guest row carries a deliberately unusable random hash, so the control
 *    could not succeed even if the user found their way through it. An affordance that cannot
 *    work is worse than a missing one.
 *
 * What replaces them is the single thing a guest can actually do here, framed as a gain (keep what
 * you already did) rather than a threat (you will lose it) -- the standing 7-day fact still gets
 * stated plainly, once, because a visitor surprised by a deletion is a worse outcome than one who
 * was told; it just isn't the headline.
 */
function GuestAccountSection({ autoExpand, onConverted }: { autoExpand: boolean; onConverted: () => void }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus lands in the first field the moment the form appears -- whether it opened because the
  // user clicked the button below or because they arrived from a conversion CTA elsewhere and the
  // form was already expanded for them. Without this the second case leaves focus on the panel's
  // close button, one Tab away from a form the user explicitly asked for.
  useEffect(() => {
    if (expanded) requestAnimationFrame(() => nameRef.current?.focus());
  }, [expanded]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (name.trim().length === 0) {
      setError("Let us know what to call you.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("That doesn't look like a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const result = await upgradeToAccount(email.trim(), name.trim(), password);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // No reload -- see upgradeToAccount()'s doc comment. The session store has already emitted the
    // real user, so the guest banner and the mock-exam gate have unlocked behind this panel.
    onConverted();
  };

  return (
    <div style={{ marginBottom: 18 }} data-testid="guest-account-section">
      <span style={panelLabelStyle}>Account</span>
      <div style={{ fontSize: 14, color: "var(--text-body)", marginBottom: 2 }}>You&rsquo;re exploring the demo</div>
      <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
        Create a free account to keep your progress and unlock mock exams. Everything you&rsquo;ve
        done so far comes with you. Without one, this demo is deleted after 7 days of inactivity.
      </p>

      {!expanded && (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setError(null);
          }}
          style={{
            width: "100%",
            background: "var(--accent)",
            border: "none",
            borderRadius: 6,
            color: "var(--canvas)",
            fontSize: 13,
            fontWeight: 500,
            padding: "9px 0",
            minHeight: 36,
            cursor: "pointer",
          }}
        >
          Create a free account
        </button>
      )}

      {expanded && (
        <form onSubmit={submit}>
          {/* Real <label htmlFor> on every field rather than placeholder-only labelling: this is an
              account-creation form, so a screen reader must announce each field by name, and a
              placeholder disappears the moment someone starts typing. */}
          <div style={{ marginBottom: 8 }}>
            <label style={fieldLabelStyle} htmlFor="upgrade-name">
              Name
            </label>
            <input
              ref={nameRef}
              id="upgrade-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={panelInputStyle}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={fieldLabelStyle} htmlFor="upgrade-email">
              Email
            </label>
            <input
              id="upgrade-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={panelInputStyle}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={fieldLabelStyle} htmlFor="upgrade-password">
              Password
            </label>
            <PasswordInput
              id="upgrade-password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={200}
              value={password}
              onChange={setPassword}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              style={panelInputStyle}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={fieldLabelStyle} htmlFor="upgrade-password-confirm">
              Confirm password
            </label>
            <PasswordInput
              id="upgrade-password-confirm"
              autoComplete="new-password"
              maxLength={200}
              value={confirm}
              onChange={setConfirm}
              style={panelInputStyle}
            />
          </div>

          {error && (
            <div role="alert" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--status-incorrect)", marginBottom: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                background: "var(--accent)",
                border: "none",
                borderRadius: 6,
                color: "var(--canvas)",
                fontSize: 13,
                fontWeight: 500,
                padding: "8px 0",
                minHeight: 36,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Creating…" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setError(null);
                setPassword("");
                setConfirm("");
              }}
              style={{ flex: 1, background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-muted)", fontSize: 13, padding: "8px 0", minHeight: 36, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const open = useSettingsOpen();
  // "upgrade" means a guest conversion CTA opened this panel (GuestBanner, MockExams' gate), so
  // the account form should already be expanded rather than one more click away.
  const intent = useSettingsIntent();
  const { settings } = useProgress();
  const me = useSessionUser();
  // Drives the guest-specific sign-out treatment below. Reads from the live session store rather
  // than a prop, so it flips to false the moment upgradeToAccount() converts the account and the
  // one-way-door warning stops applying without needing a reload.
  const isGuest = me?.isGuest === true;
  const [justConverted, setJustConverted] = useState(false);
  // Sign-out is unrecoverable for a guest (no password, no reachable email -- the cookie is the
  // only key), so it gets a click-again-to-confirm step that a real account's sign-out doesn't
  // need. Same pattern Admin.tsx already uses for its destructive actions.
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  // Issue #180. Collapsed by default so Settings doesn't rest on a delete control.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Single source for "the delete button may fire", so the disabled attribute and the styling can
  // never disagree — see the button's own comment.
  const deleteArmed =
    me?.hasPassword === true
      ? deletePassword.length > 0
      : deleteConfirm.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;
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

        {me?.isGuest && !justConverted && (
          <GuestAccountSection autoExpand={intent === "upgrade"} onConverted={() => setJustConverted(true)} />
        )}

        {justConverted && me && (
          // Deliberately a distinct success state rather than silently swapping in the normal
          // Account section: the conversion is the moment this whole feature exists for, and it
          // happens with no page reload, so without an explicit acknowledgment the only feedback
          // is a banner vanishing somewhere behind the panel.
          <div style={{ marginBottom: 18 }} role="status">
            <span style={panelLabelStyle}>Account</span>
            <div style={{ fontSize: 14, color: "var(--text-body)", marginBottom: 2 }}>{me.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{me.email}</div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)" }}>
              You&rsquo;re all set — your progress is saved to this account, and mock exams are
              unlocked.
            </p>
          </div>
        )}

        {me && !me.isGuest && !justConverted && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Account</label>
            {/* Both read-only — name and email are shown so someone who forgets which identity
                they're signed in as can check, but neither is user-editable in this app: email is
                the identity/lookup key (server.ts's normalizeEmail()), and name-editing (issue
                #41's original design) was deliberately removed rather than kept as a stray
                affordance — see DOCS_MAP.md/CLAUDE.md for the removal. */}
            <div style={{ fontSize: 14, color: "var(--text-body)", marginBottom: 2 }}>{me.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{me.email}</div>

            <div>
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
            disabled={resetInput !== RESET_PHRASE || resetting}
            onClick={async () => {
              setResetting(true);
              setResetFailed(false);
              const ok = await resetProgressConfirmed();
              setResetting(false);
              if (ok) {
                setResetDone(true);
                setResetInput("");
              } else {
                setResetFailed(true);
              }
            }}
            style={{
              width: "100%",
              background: resetInput === RESET_PHRASE && !resetting ? "var(--status-incorrect)" : "var(--hairline)",
              color: resetInput === RESET_PHRASE && !resetting ? "var(--canvas)" : "var(--text-dim)",
              border: "none",
              borderRadius: 6,
              padding: "9px 0",
              fontSize: 13,
              fontWeight: 500,
              cursor: resetInput === RESET_PHRASE && !resetting ? "pointer" : "not-allowed",
            }}
          >
            {resetting ? "Resetting…" : resetDone ? "Progress reset" : "Reset everything"}
          </button>
          {resetFailed && (
            <div style={{ fontSize: 12, color: "var(--status-incorrect)", marginTop: 6 }}>
              Reset failed — check your connection and try again.
            </div>
          )}
        </div>

        {/* Sign out lives here, last before the footer note, deliberately -- not up in Account
            next to identity info. It's a rare, session-ending action (session cookies are
            400-day, per lib/session.ts), not an account-management one, so it belongs at the end
            of the menu (the conventional "File > Exit" position -- iOS Settings, Slack, GitHub all
            put the literal sign-out control last, behind its own divider, even though identity
            info itself shows near the top). Kept in the same neutral/muted styling as every other
            non-destructive button here, not Reset's red treatment -- signing out doesn't touch
            data (see the footer note right below, which now reassures on exactly this point right
            where someone is about to click). */}
        {me && (
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14, marginBottom: 18 }}>
            {/* For a real account, sign-out is reversible: come back, type your password. For a
                guest it is a one-way door -- there is no password and the generated address can't
                receive mail, so the session cookie is the only key to that progress, and clicking
                this destroys it. Error prevention over an error message: name the consequence in
                the label and require a second, deliberate click. */}
            {isGuest && confirmingSignOut && (
              <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.5, color: "var(--status-incorrect)" }}>
                This ends the demo for good. There&rsquo;s no password to sign back in with, so
                everything you&rsquo;ve done here is gone. Create a free account first to keep it.
              </p>
            )}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                if (isGuest && !confirmingSignOut) {
                  setConfirmingSignOut(true);
                  return;
                }
                signOut();
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: `1px solid ${isGuest && confirmingSignOut ? "var(--status-incorrect)" : "var(--hairline)"}`,
                borderRadius: 6,
                color: isGuest && confirmingSignOut ? "var(--status-incorrect)" : "var(--text-muted)",
                fontSize: 13,
                padding: "9px 0",
                minHeight: 36,
                cursor: signingOut ? "default" : "pointer",
              }}
            >
              {signingOut
                ? "Signing out…"
                : isGuest
                  ? confirmingSignOut
                    ? "Yes, discard the demo and sign out"
                    : "End demo and sign out"
                  : "Sign out"}
            </button>
            {isGuest && confirmingSignOut && (
              <button
                type="button"
                onClick={() => setConfirmingSignOut(false)}
                style={{ width: "100%", marginTop: 8, background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-muted)", fontSize: 13, padding: "9px 0", minHeight: 36, cursor: "pointer" }}
              >
                Keep exploring
              </button>
            )}
          </div>
        )}

        {/* Issue #180 — the right of erasure, exercised by the person rather than requested from
            the operator. Placed after sign-out because it is strictly more destructive and this is
            the end of the menu; kept behind a disclosure so the resting state of Settings isn't a
            red button. A guest sees nothing here: signing out already destroys a guest account
            irreversibly (see the block above), and offering two differently-worded one-way doors
            in the same panel is a way to get the wrong one clicked. */}
        {me && !isGuest && (
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14, marginBottom: 18 }}>
            {!deleteOpen ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                style={{ background: "transparent", border: "none", padding: 0, color: "var(--text-dim)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
              >
                Delete my account
              </button>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "var(--status-incorrect)", lineHeight: 1.55, marginBottom: 8 }}>
                  This deletes your account and everything in it — every practice and mock attempt,
                  your study plan, and your flashcard history. It happens immediately, it cannot be
                  undone, and there is no backup to restore from. Export your progress first if you
                  want to keep a copy.
                </div>
                {/* A Google-only account has no password hash to verify, so there is nothing to
                    authenticate against -- it types a phrase instead. Labelled as confirmation
                    rather than dressed up as a security check, because that is what it is. */}
                {me.hasPassword ? (
                  <PasswordInput
                    id="delete-account-password"
                    value={deletePassword}
                    onChange={setDeletePassword}
                    placeholder="Your current password"
                    autoComplete="current-password"
                    style={panelInputStyle}
                  />
                ) : (
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={DELETE_CONFIRM_PHRASE}
                    aria-label={`Type ${DELETE_CONFIRM_PHRASE} to confirm`}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-body)", fontSize: 13, padding: "7px 10px", minHeight: 36 }}
                  />
                )}
                {!me.hasPassword && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                    Type <strong>{DELETE_CONFIRM_PHRASE}</strong> to confirm.
                  </div>
                )}
                {/* `armed` drives BOTH the disabled attribute and the styling. Keeping them in one
                    expression is the point: the first version styled this red and enabled-looking
                    while it was actually disabled, which on a destructive control reads as "this
                    will fire" and produces a confused click rather than a prevented one. The Reset
                    control above already greys out the same way. */}
                <button
                  type="button"
                  disabled={!deleteArmed || deleting}
                  onClick={async () => {
                    setDeleting(true);
                    setDeleteError(null);
                    const result = await deleteAccount(
                      me.hasPassword ? { password: deletePassword } : { confirm: deleteConfirm },
                    );
                    if (result.ok) {
                      // Full reload, not a state update: the account no longer exists, so every
                      // cached page and in-memory store in this tab now describes something gone.
                      // Same reasoning login()/logout() document for their own reloads.
                      window.location.reload();
                      return;
                    }
                    setDeleting(false);
                    setDeleteError(result.error);
                  }}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    background: "transparent",
                    border: `1px solid ${deleteArmed && !deleting ? "var(--status-incorrect)" : "var(--hairline)"}`,
                    borderRadius: 6,
                    color: deleteArmed && !deleting ? "var(--status-incorrect)" : "var(--text-dim)",
                    fontSize: 13,
                    padding: "9px 0",
                    minHeight: 36,
                    cursor: deleteArmed && !deleting ? "pointer" : "not-allowed",
                  }}
                >
                  {deleting ? "Deleting…" : "Permanently delete my account"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeletePassword("");
                    setDeleteConfirm("");
                    setDeleteError(null);
                  }}
                  style={{ width: "100%", marginTop: 8, background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--text-muted)", fontSize: 13, padding: "9px 0", minHeight: 36, cursor: "pointer" }}
                >
                  Cancel
                </button>
                {deleteError && (
                  <div style={{ fontSize: 12, color: "var(--status-incorrect)", marginTop: 6 }}>{deleteError}</div>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 12 }}>
            {getStorageBackend() === "http"
              ? "Progress is saved to this server — it survives clearing browser data."
              : "Progress is saved in this browser only — clearing site data will erase it."}
          </div>
          {/* Issue #184. Settings is where someone goes with a question about their account or
              their data, so it is the right place inside the app to reach the policies from. */}
          <SiteFooter legalPages={me?.legalPages === true} supportAvailable={me?.supportAvailable === true} variant="compact" />
        </div>
      </div>
    </div>
  );
}
