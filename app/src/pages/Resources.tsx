/**
 * Resources — spec §6.10. The exam-dump caution stays prominent at the top, official/exam-wide
 * sources first, then by-domain course listings. The caution text itself isn't in content.json
 * (the pipeline's resources.ts intentionally emits no structured entries for that prose section,
 * since there's nothing to link) — it's fixed UI copy here, same as the mock pre-start gate's.
 * By-domain entries mostly have `url: null` (the source lists course names, not links) — those
 * render as plain text, never a pill/chip that would visually promise a click they can't deliver.
 */

import { useContent } from "../lib/useContent";

export function Resources() {
  const { content, error } = useContent();
  if (error) return <div style={{ color: "var(--status-incorrect)" }}>Couldn't load content: {error.message}</div>;
  if (!content) return <div style={{ color: "var(--text-dim)" }}>Loading…</div>;

  const official = content.resources.filter((r) => r.domainId === null);
  const byDomain = content.domains.map((d) => ({
    domain: d,
    resources: content.resources.filter((r) => r.domainId === d.id),
  }));

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>Resources</h1>

      <div style={{ border: "1px solid var(--status-warning)", background: "rgba(201,187,74,.06)", borderRadius: "var(--radius-card)", padding: "14px 16px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-body)" }}>
          Avoid anything claiming to be actual exam questions or a "dump." Snowflake's candidate
          agreement prohibits sharing or using real exam content, and using dumps risks
          certification revocation even after passing.
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 14 }}>
          Official
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {official.map((r) => (
            <div key={r.title} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>
                  {r.title}
                </a>
              ) : (
                <span style={{ fontSize: 14, color: "var(--text-body)" }}>{r.title}</span>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", background: "rgba(255,255,255,.05)", borderRadius: 4, padding: "1px 6px" }}>
                official
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 14 }}>
        By domain
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {byDomain.map(({ domain, resources }) =>
          resources.length === 0 ? null : (
            <div key={domain.id} style={{ background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>D{domain.number}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-heading)" }}>{domain.title}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resources.map((r) =>
                  r.url ? (
                    <a key={r.title} href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                      {r.title}
                    </a>
                  ) : (
                    <span key={r.title} style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {r.title}
                    </span>
                  ),
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
