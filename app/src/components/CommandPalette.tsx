/**
 * ⌘K command palette — spec §6.12: 640px panel, input at top, results grouped Pages / Domains /
 * Notes / Questions, max five per group with a count, substring match only (no fuzzy scoring).
 * Mounted once at the App root so the global ⌘K/Escape listeners work on every route, including
 * the session runner (which has no sidebar, so no visible trigger button there — the shortcut
 * still works).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { closePalette, togglePalette, usePaletteOpen } from "../lib/paletteStore";
import { closeSettings } from "../lib/settingsStore";
import { loadSearchIndex, type SearchIndexEntry } from "../lib/search";
import { useProgress } from "../lib/progress";

const PAGE_ROUTES: Record<string, string> = {
  Dashboard: "/",
  Notes: "/notes/d1",
  Practice: "/practice",
  "Mock Exams": "/mocks",
  Flashcards: "/drill",
  "Study Plan": "/plan",
  Resources: "/resources",
  Setup: "/setup",
  Analytics: "/analytics",
};

type Group = "Pages" | "Domains" | "Notes" | "Questions";

const GROUP_FOR: Record<SearchIndexEntry["type"], Group> = {
  page: "Pages",
  domain: "Domains",
  heading: "Notes",
  paragraph: "Notes",
  question: "Questions",
};

const GROUP_ORDER: Group[] = ["Pages", "Domains", "Notes", "Questions"];
const MAX_PER_GROUP = 5;

export function CommandPalette() {
  const open = usePaletteOpen();
  const navigate = useNavigate();
  const progress = useProgress();
  const [index, setIndex] = useState<SearchIndexEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !index) loadSearchIndex().then(setIndex).catch(() => setIndex([]));
  }, [open, index]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        closeSettings();
        togglePalette();
      } else if (e.key === "Escape" && open) {
        closePalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = !index ? [] : q ? index.filter((e) => e.text.toLowerCase().includes(q)) : index.filter((e) => e.type === "page");
    const byGroup = new Map<Group, SearchIndexEntry[]>();
    for (const entry of matches) {
      const group = GROUP_FOR[entry.type];
      const list = byGroup.get(group) ?? [];
      if (list.length < MAX_PER_GROUP) list.push(entry);
      byGroup.set(group, list);
    }
    const counts = new Map<Group, number>();
    for (const entry of matches) counts.set(GROUP_FOR[entry.type], (counts.get(GROUP_FOR[entry.type]) ?? 0) + 1);
    return GROUP_ORDER.map((g) => ({ group: g, entries: byGroup.get(g) ?? [], total: counts.get(g) ?? 0 })).filter((g) => g.entries.length > 0);
  }, [index, query]);

  const flatResults = useMemo(() => grouped.flatMap((g) => g.entries), [grouped]);

  const routeFor = (entry: SearchIndexEntry): string => {
    switch (entry.type) {
      case "page":
        return PAGE_ROUTES[entry.refId] ?? "/";
      case "domain":
        return `/notes/${entry.refId}`;
      case "heading":
      case "paragraph":
        return `/notes/${entry.refId}`;
      case "question": {
        const attempt = [...progress.attempts]
          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
          .find((a) => entry.refId in a.answers);
        if (attempt) return `/results/${attempt.id}`;
        return `/session/set-${entry.domainId}`;
      }
    }
  };

  const openResult = (entry: SearchIndexEntry) => {
    navigate(routeFor(entry));
    closePalette();
  };

  if (!open) return null;

  return (
    <div
      onClick={() => closePalette()}
      style={{ position: "fixed", inset: 0, background: "var(--scrim)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12vh 16px 16px", zIndex: 60 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 640, background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--overlay-shadow)" }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Search notes, questions, pages…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, flatResults.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && flatResults[highlight]) {
              openResult(flatResults[highlight]);
            }
          }}
          style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid var(--hairline)", color: "var(--text-heading)", fontSize: 16, padding: "16px 18px", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ maxHeight: "46vh", overflow: "auto", padding: 8 }}>
          {grouped.length === 0 && <div style={{ padding: "16px 12px", fontSize: 13, color: "var(--text-dim)" }}>No results.</div>}
          {grouped.map(({ group, entries, total }) => (
            <div key={group} style={{ marginBottom: 6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-dim)", padding: "8px 12px 4px" }}>
                {group} ({total})
              </div>
              {entries.map((entry) => {
                const flatIndex = flatResults.indexOf(entry);
                return (
                  <div
                    key={`${entry.type}-${entry.refId}-${entry.text.slice(0, 20)}`}
                    onClick={() => openResult(entry)}
                    onMouseEnter={() => setHighlight(flatIndex)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: flatIndex === highlight ? "var(--palette-highlight)" : "transparent",
                    }}
                  >
                    <span style={{ fontSize: 14, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.text}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                      {entry.type}
                      {entry.domainId ? ` · ${entry.domainId.toUpperCase()}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, padding: "10px 18px", borderTop: "1px solid var(--hairline)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          <span>↵ open</span>
          <span>↑↓ move</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
