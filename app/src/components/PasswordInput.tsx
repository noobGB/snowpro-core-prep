/**
 * A password <input> with a show/hide toggle, shared by LoginGate.tsx and SettingsPanel.tsx rather
 * than duplicated per field -- every password field in this app needs the same toggle. Uses
 * Feather's eye/eye-off glyphs as inline SVG, matching Sidebar.tsx's existing icon style (this app
 * has no icon library dependency, so a new field type shouldn't introduce one just for this).
 */

import { useState } from "react";

function EyeIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {crossedOut ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  "aria-describedby"?: string;
  /** The caller's own input styling (LoginGate.tsx and SettingsPanel.tsx each have their own) --
   *  this component only adds right padding for the toggle button, it never owns the base look. */
  style: React.CSSProperties;
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
  maxLength,
  onKeyDown,
  inputRef,
  style,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ ...style, paddingRight: 40 }}
        aria-describedby={rest["aria-describedby"]}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          padding: 6,
          display: "flex",
          alignItems: "center",
          color: "var(--text-dim)",
          cursor: "pointer",
        }}
      >
        <EyeIcon crossedOut={visible} />
      </button>
    </div>
  );
}
