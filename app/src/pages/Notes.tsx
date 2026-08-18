/**
 * Notes reader — spec §6.2. Prose at a ~65-70-character measure plus a sticky, scrollspy table of
 * contents. The header carries a domain-wide "quiz me" button (always available — it's just the
 * domain's own practice set). Per-SECTION "quiz me on this section" hover actions are also wired
 * up structurally, but will never actually render today: the content pipeline deliberately leaves
 * every question's `section` field undefined (no source data maps a question to a note
 * subsection — see pipeline's domainNotes.ts/questionCore.ts docs), so no section ever has
 * questions to filter by. That's the spec's own documented fallback ("if a section has none, the
 * action is absent"), not a bug here.
 *
 * A small domain-switcher pill row is an addition beyond the wireframe (which is nav | prose |
 * TOC with no in-page domain switching shown) — without it there'd be no way to move between
 * domains except editing the URL, since the sidebar's own "Notes" link only ever points at d1.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useContent } from "../lib/useContent";
import { useNotes } from "../lib/useNotes";

export function Notes() {
  const { domainId } = useParams<{ domainId: string }>();
  const { content, error: contentError } = useContent();
  const { notes, error: notesError } = useNotes(domainId);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  const domain = content?.domains.find((d) => d.id === domainId);
  const domainSet = content?.sets.find((s) => s.domainId === domainId && s.kind === "domain");

  const questionsBySection = useMemo(() => {
    const map = new Map<string, number>();
    if (!content) return map;
    for (const q of content.questions) {
      if (!q.section) continue;
      map.set(q.section, (map.get(q.section) ?? 0) + 1);
    }
    return map;
  }, [content]);

  useEffect(() => {
    if (!notes) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const anchor = (entry.target as HTMLElement).dataset.anchor;
            if (anchor) setActiveAnchor(anchor);
          }
        }
      },
      { rootMargin: "-80px 0px -75% 0px" },
    );
    for (const el of sectionRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [notes]);

  if (contentError || notesError) {
    return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load notes: {(contentError ?? notesError)?.message}</div>;
  }
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;
  if (!domain) return <div style={{ color: "var(--text-dim)" }}>No such domain: {domainId}</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {content.domains.map((d) => (
          <Link
            key={d.id}
            to={`/notes/${d.id}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              padding: "5px 10px",
              borderRadius: 6,
              border: `1px solid ${d.id === domainId ? "var(--accent)" : "var(--hairline)"}`,
              color: d.id === domainId ? "var(--text-heading)" : "var(--text-dim)",
              background: d.id === domainId ? "var(--raised)" : "transparent",
            }}
          >
            D{d.number}
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.014em", color: "var(--text-heading)" }}>{domain.title}</h1>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", background: "var(--surface-subtle)", borderRadius: 4, padding: "2px 7px" }}>
                {Math.round(domain.weight * 100)}%
              </span>
            </div>
            {domainSet && (
              <Link
                to={`/session/${domainSet.id}`}
                style={{ display: "inline-flex", alignItems: "center", background: "var(--accent)", color: "var(--canvas)", borderRadius: 6, padding: "8px 14px", minHeight: 36, fontSize: 13, fontWeight: 500 }}
              >
                Quiz me on this domain
              </Link>
            )}
          </div>

          {/* "ch" is the digit-glyph width, not the average prose character width — Inter's lowercase
              average runs narrower, so a nominal 68ch box was actually rendering ~85 characters per
              line. 54ch targets the same ~65-70 real character measure Notion/Linear use. */}
          <div style={{ maxWidth: "54ch" }}>
            {notes?.sections.map((section) => {
              const sectionQuestionCount = questionsBySection.get(section.id) ?? 0;
              return (
                <section
                  key={section.id}
                  data-anchor={section.anchor}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(section.anchor, el);
                    else sectionRefs.current.delete(section.anchor);
                  }}
                  id={section.anchor}
                  style={{ marginBottom: 28, scrollMarginTop: 80 }}
                >
                  <div className="quizme-trigger" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--text-heading)" }}>{section.title}</h2>
                    {sectionQuestionCount > 0 && domainSet && (
                      <Link to={`/session/${domainSet.id}`} className="quizme-btn" style={{ fontSize: 12 }}>
                        Quiz me on this section
                      </Link>
                    )}
                  </div>
                  <div className="notes-prose" style={{ fontSize: 16, lineHeight: 1.6, color: "var(--text-body)" }} dangerouslySetInnerHTML={{ __html: section.html }} />
                </section>
              );
            })}
            {!notes && <div style={{ color: "var(--text-dim)" }}>Loading notes…</div>}
          </div>
        </div>

        <aside className="desktop-only" style={{ width: 200, flexShrink: 0, position: "sticky", top: 20 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
            On this page
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: "1px solid var(--hairline)" }}>
            {notes?.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.anchor}`}
                style={{
                  fontSize: 13,
                  padding: "5px 0 5px 12px",
                  marginLeft: -1,
                  borderLeft: `2px solid ${activeAnchor === section.anchor ? "var(--accent)" : "transparent"}`,
                  color: activeAnchor === section.anchor ? "var(--text-heading)" : "var(--text-dim)",
                }}
              >
                {section.title}
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
