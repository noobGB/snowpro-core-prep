/**
 * Tests for cheatsheet.ts's front/back split rules against the real edge cases found: a bold
 * term followed by a parenthetical qualifier before the colon (the parenthetical must stay in
 * back, not be dropped), a bare paragraph with no bullet at all, and a sentence-only bullet with
 * no bold term (falls back to the topic heading as front).
 */

import { describe, expect, it } from "vitest";
import { parseCheatsheet } from "../src/parsers/cheatsheet.js";

const FIXTURE = `# Cheatsheet fixture

## Caching

- **Result cache**: Cloud Services layer, 24 hours, zero compute cost when hit.
- **Search Optimization Service** (Enterprise+): speeds up highly selective point-lookups
  (equality/substring) on columns clustering doesn't naturally help.
- 100 questions, 115 minutes, pass mark 750/1000.

## Editions (strict superset order)

Standard → Enterprise → Business Critical → Virtual Private Snowflake (VPS)
`;

describe("parseCheatsheet", () => {
  const cards = parseCheatsheet(FIXTURE);

  it("splits a plain 'Term: value' bullet on the colon", () => {
    const card = cards.find((c) => c.front === "Result cache");
    expect(card?.back).toBe("Cloud Services layer, 24 hours, zero compute cost when hit.");
  });

  it("keeps a parenthetical qualifier between the bold term and colon in the back text", () => {
    const card = cards.find((c) => c.front === "Search Optimization Service");
    expect(card?.back).toBe(
      "(Enterprise+): speeds up highly selective point-lookups (equality/substring) on columns clustering doesn't naturally help.",
    );
  });

  it("falls back to the topic heading as front for a sentence-only bullet with no bold term", () => {
    const card = cards.find((c) => c.back === "100 questions, 115 minutes, pass mark 750/1000.");
    expect(card?.front).toBe("Caching");
  });

  it("falls back to the topic heading as front for a bare paragraph with no bullet at all", () => {
    const card = cards.find((c) =>
      c.back.startsWith("Standard → Enterprise → Business Critical"),
    );
    expect(card?.front).toBe("Editions (strict superset order)");
  });
});
