/**
 * Standing reminder that this is a demo session and its progress is temporary (issue #160).
 *
 * Mounted by AppShell beside ConflictBanner. That slot does real work: Runner's /session/:setId
 * route bypasses AppShell entirely (spec §6.4, "nothing competes with the questions"), so this
 * banner is automatically absent during a live exam without needing a route check of its own.
 *
 * Renders nothing for a normal account, so AppShell can mount it unconditionally.
 *
 * The honesty rule here: it states the expiry plainly rather than burying it. A visitor who loses a
 * week of study to a surprise deletion is a worse outcome than one who was mildly nagged.
 */

import { useSessionUser } from "../lib/session";

interface GuestBannerProps {
  /** Opens the settings panel on the account section, where the upgrade form lives. */
  onCreateAccount: () => void;
}

export function GuestBanner({ onCreateAccount }: GuestBannerProps) {
  const user = useSessionUser();
  if (!user?.isGuest) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        margin: "0 0 16px",
        borderRadius: 8,
        border: "1px solid var(--hairline)",
        background: "var(--raised)",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>
        You&rsquo;re exploring as a guest. Your progress is deleted after 7 days of inactivity, and
        mock exams need an account.
      </span>
      <button
        type="button"
        onClick={onCreateAccount}
        style={{
          padding: "5px 12px",
          borderRadius: 6,
          border: "1px solid var(--hairline)",
          background: "transparent",
          color: "var(--text-heading)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Save my progress
      </button>
    </div>
  );
}
