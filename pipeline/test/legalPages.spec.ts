/**
 * Tests the legal/disclosure pages and the operator config behind them.
 *
 * The assertion that matters most is the negative one: an unconfigured deployment must publish
 * NOTHING. This repository is public, so any default operator identity would mean every self-hoster
 * ships a privacy policy naming somebody else as the controller of their users' data — a document
 * that is confidently wrong and points erasure requests at a stranger. Silence is the correct
 * behaviour there, and it is the property under test rather than the happy path.
 */

import { describe, expect, it } from "vitest";
import { resolveLegalConfig, type LegalConfig } from "../src/write/legalConfig.js";
import { renderLegalPages, LEGAL_PAGE_PATHS } from "../src/write/legalPages.js";

const FULL_ENV = {
  SNOWPRO_LEGAL_OPERATOR: "Ada Lovelace",
  SNOWPRO_LEGAL_CONTACT: "ada@example.com",
  SNOWPRO_SITE_ORIGIN: "https://example.test",
} as NodeJS.ProcessEnv;

function cfg(overrides: Partial<LegalConfig> = {}): LegalConfig {
  return { ...(resolveLegalConfig(FULL_ENV) as LegalConfig), ...overrides };
}

function byPath(files: ReturnType<typeof renderLegalPages>, relPath: string): string {
  const f = files.find((x) => x.relPath === relPath);
  if (!f) throw new Error(`No generated file at ${relPath}. Got: ${files.map((x) => x.relPath).join(", ")}`);
  return f.contents;
}

describe("resolveLegalConfig", () => {
  it("returns null when no operator is declared", () => {
    expect(resolveLegalConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("returns null when any one part of the identity is missing", () => {
    // Each part alone produces a document that looks compliant and isn't: a named controller with
    // no reachable address cannot service a request, an address with no named controller does not
    // say who is answerable, and a missing origin means the canonical claims the document lives
    // somewhere it doesn't.
    for (const key of ["SNOWPRO_LEGAL_OPERATOR", "SNOWPRO_LEGAL_CONTACT", "SNOWPRO_SITE_ORIGIN"] as const) {
      const partial = { ...FULL_ENV };
      delete partial[key];
      expect(resolveLegalConfig(partial), `${key} missing should yield no config`).toBeNull();
    }
  });

  it("returns null for an origin that is not an absolute http(s) origin", () => {
    for (const bad of ["example.test", "/relative", "ftp://example.test", "https://example.test/path"]) {
      expect(
        resolveLegalConfig({ ...FULL_ENV, SNOWPRO_SITE_ORIGIN: bad } as NodeJS.ProcessEnv),
        `${bad} should be rejected`,
      ).toBeNull();
    }
  });

  it("returns null for a contact that isn't an address", () => {
    expect(
      resolveLegalConfig({ SNOWPRO_LEGAL_OPERATOR: "Ada", SNOWPRO_LEGAL_CONTACT: "not-an-email" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("treats whitespace-only values as unset", () => {
    expect(
      resolveLegalConfig({ SNOWPRO_LEGAL_OPERATOR: "   ", SNOWPRO_LEGAL_CONTACT: "ada@example.com" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("strips trailing slashes from the origin so canonicals never double up", () => {
    const c = resolveLegalConfig({ ...FULL_ENV, SNOWPRO_SITE_ORIGIN: "https://example.com///" } as NodeJS.ProcessEnv);
    expect(c?.siteOrigin).toBe("https://example.com");
  });

  it("canonicalises the legal pages to the CONFIGURED origin, not this deployment's", () => {
    // Regression guard for a real bug the leak test below found: layout() hardcoded both the origin
    // and the author, so a self-hoster's privacy policy canonicalised to somebody else's domain and
    // credited somebody else as its author.
    const html = renderLegalPages(cfg()).find((f) => f.relPath === "privacy/index.html")!.contents;
    expect(html).toContain('<link rel="canonical" href="https://example.test/privacy/">');
    expect(html).toContain('<meta name="author" content="Ada Lovelace">');
  });

  it("names only the subprocessors this deployment actually uses", () => {
    const bare = resolveLegalConfig(FULL_ENV);
    expect(bare?.subprocessors.map((s) => s.name)).toEqual(["Railway"]);

    const full = resolveLegalConfig({
      ...FULL_ENV,
      SNOWPRO_GOOGLE_CLIENT_ID: "x.apps.googleusercontent.com",
      SNOWPRO_EMAIL_API_KEY: "key",
    } as NodeJS.ProcessEnv);
    expect(full?.subprocessors.map((s) => s.name)).toEqual(["Railway", "Google", "Brevo"]);
  });
});

describe("renderLegalPages", () => {
  it("generates nothing at all when the operator is undeclared", () => {
    expect(renderLegalPages(null)).toEqual([]);
  });

  it("generates every page plus security.txt when configured", () => {
    const files = renderLegalPages(cfg());
    const paths = files.map((f) => f.relPath).sort();
    expect(paths).toEqual(
      [...LEGAL_PAGE_PATHS.map((p) => `${p}/index.html`), ".well-known/security.txt"].sort(),
    );
  });

  it("never hardcodes an identity — every page carries the configured operator and contact", () => {
    // The real risk this guards: a page written with the author's own name inlined into the prose
    // would pass a rendering test while making every other deployment's policy a lie.
    const files = renderLegalPages(cfg());
    const html = files.filter((f) => f.relPath.endsWith(".html"));
    for (const f of html) {
      expect(f.contents, `${f.relPath} does not name the configured operator`).toContain("Ada Lovelace");
    }
    const withContact = files.filter((f) => f.contents.includes("ada@example.com"));
    expect(withContact.length).toBe(files.length);
  });

  it("leaks no other deployment's identity", () => {
    const rendered = renderLegalPages(cfg()).map((f) => f.contents).join("\n");
    for (const leaked of ["Gaurav", "gaurav.gbaba", "gauravbarwalia"]) {
      expect(rendered, `a real operator identity is baked into the prose (${leaked})`).not.toContain(leaked);
    }
  });

  it("keeps the site presenting as a product (issue #177)", () => {
    const rendered = renderLegalPages(cfg()).map((f) => f.contents).join("\n");
    for (const pattern of [/open[\s-]?source/i, /self[\s-]?host/i, /\bMIT\b/, /github\.com/i]) {
      expect(rendered, `legal pages present the site as open source (matched ${pattern})`).not.toMatch(pattern);
    }
  });

  it("states the retention periods the code actually enforces", () => {
    // These are pinned to SESSION_MAX_AGE_MS, PASSWORD_RESET_TOKEN_TTL_MS and DEFAULT_TTL_DAYS.
    // A privacy policy that misstates retention is worse than one that omits it.
    const privacy = byPath(renderLegalPages(cfg()), "privacy/index.html");
    expect(privacy).toContain("400 days");
    expect(privacy).toContain("1 hour");
    expect(privacy).toContain("7 days");
  });

  it("enumerates the complete client-side storage inventory by name", () => {
    const privacy = byPath(renderLegalPages(cfg()), "privacy/index.html");
    for (const key of ["snowprep_session", "snowprep_oauth_state", "snowprep.progress"]) {
      expect(privacy, `${key} is not disclosed`).toContain(key);
    }
    expect(privacy).toContain('id="cookies"');
  });

  it("points people at the self-service controls rather than at an inbox", () => {
    // Erasure and portability are both one click in Settings. A policy that says "email us" for
    // either would understate what the software already does.
    const privacy = byPath(renderLegalPages(cfg()), "privacy/index.html");
    expect(privacy).toContain("Settings → Delete my account");
    expect(privacy).toContain("Settings → Export");
  });

  it("keeps the trademark disclaimer in the terms", () => {
    const terms = byPath(renderLegalPages(cfg()), "terms/index.html");
    expect(terms).toContain("not affiliated with, endorsed by, or sponsored by");
    expect(terms).toContain("Snowflake Inc.");
  });

  it("does not claim full accessibility conformance", () => {
    // An untested blanket claim is the one thing an accessibility statement must not do.
    const a11y = byPath(renderLegalPages(cfg()), "accessibility/index.html");
    expect(a11y).toContain("partial");
    expect(a11y).toContain("Known gaps");
  });

  it("emits an RFC 9116 security.txt with a future Expires and a resolvable Policy", () => {
    const txt = byPath(renderLegalPages(cfg()), ".well-known/security.txt");
    const expires = /^Expires: (.+)$/m.exec(txt)?.[1];
    expect(expires, "Expires is mandatory in RFC 9116").toBeDefined();
    const when = new Date(expires as string);
    expect(when.getTime()).toBeGreaterThan(Date.now());
    // Under a year out, as RFC 9116 recommends.
    expect(when.getTime()).toBeLessThan(Date.now() + 366 * 86_400_000);

    expect(txt).toContain(`Contact: mailto:ada@example.com`);
    // The Policy URL must be a page this generator actually produces -- it used to point at the
    // repository's SECURITY.md, which issue #177 made unavailable to the site.
    expect(txt).toMatch(/^Policy: https?:\/\/\S+\/security\/$/m);
    expect(LEGAL_PAGE_PATHS).toContain("security");
  });

  it("escapes an operator name containing HTML", () => {
    const evil = cfg({ operatorName: '<script>alert(1)</script>' });
    const about = byPath(renderLegalPages(evil), "about/index.html");
    expect(about).not.toContain("<script>alert(1)</script>");
    expect(about).toContain("&lt;script&gt;");
  });
});
