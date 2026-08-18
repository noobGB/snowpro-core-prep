/**
 * Surfaces `progress.ts`'s write-conflict tracking, which existed but wasn't shown anywhere: if
 * this tab's debounced PUT loses a race against another writer (almost always the snowprep-quiz
 * MCP server writing progress.json directly), the tab silently re-hydrates from the server and
 * drops its own pending change. Previously that was only a console.warn — a real answer could be
 * lost with zero visible signal. Dismissible per-conflict (tracked by timestamp) rather than
 * permanent, since re-hydration already fixed the underlying state; this is just telling the user
 * it happened.
 */

import { useState } from "react";
import { useProgressConflict } from "../lib/progress";

export function ConflictBanner() {
  const conflictAt = useProgressConflict();
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  if (!conflictAt || conflictAt === dismissedAt) return null;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 16px",
        background: "var(--warning-tint)",
        borderBottom: "1px solid var(--status-warning)",
        fontSize: 13,
        color: "var(--text-body)",
      }}
    >
      <span>
        A change didn't save — this tab synced to a newer version written elsewhere (e.g. the MCP
        quiz server). Nothing is lost from that copy, but your most recent local edit here may need
        to be redone.
      </span>
      <button
        type="button"
        onClick={() => setDismissedAt(conflictAt)}
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "1px solid var(--hairline)",
          borderRadius: 6,
          color: "var(--text-body)",
          padding: "5px 10px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
