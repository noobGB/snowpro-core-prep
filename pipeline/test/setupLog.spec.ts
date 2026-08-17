/**
 * Tests for setupLog.ts's id assignment against the real file's confirmed structure: duplicated,
 * out-of-order "Step N" headings (an append-only log, never renumbered) must produce stable,
 * unique, file-order ids rather than colliding on the parsed step number. Also covers the
 * unanchored gotcha match (a mid-paragraph mention, not just a paragraph-initial one) and
 * excluding an untagged fenced code block from `commands`.
 */

import { describe, expect, it } from "vitest";
import { parseSetupLog } from "../src/parsers/setupLog.js";

const FIXTURE = `# Setup log fixture

## Status

Some running status text that isn't a step.

## Step 9 — First appearance

Some body text.

\`\`\`sql
SELECT 1;
\`\`\`

## Step 10 — Also appears once here

More body text.

## Step 9 — Second, later appearance of the same step number

Body text again. Gotcha worth remembering: this is a mid-paragraph mention, not a prefix.

\`\`\`
plain untagged output, not a command
\`\`\`

### 9a. A sub-step under the second Step 9

Sub-step body.
`;

describe("parseSetupLog", () => {
  const items = parseSetupLog(FIXTURE);

  it("skips a leading non-Step H2 section (## Status)", () => {
    expect(items.some((i) => i.title.includes("Status"))).toBe(false);
  });

  it("assigns stable, unique, file-order ids even though 'Step 9' appears twice non-consecutively", () => {
    // Restrict to the H2-level "Step 9" entries themselves (title === group); the H3 sub-step
    // under the second one also has a group starting with "Step 9" (correctly inherited from
    // its parent), so a plain group-prefix filter would over-match it too.
    const step9s = items.filter((i) => i.title === i.group && i.group.startsWith("Step 9"));
    expect(step9s).toHaveLength(2);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    // file order: first "Step 9" comes before "Step 10", which comes before the second "Step 9"
    const ids = items.map((i) => i.id);
    expect(ids.indexOf(step9s[0]!.id)).toBeLessThan(ids.indexOf(step9s[1]!.id));
  });

  it("captures a language-tagged fenced code block as a command", () => {
    const firstStep9 = items.find((i) => i.group === "Step 9 — First appearance")!;
    expect(firstStep9.commands).toEqual(["SELECT 1;"]);
  });

  it("excludes an untagged fenced code block from commands", () => {
    const secondStep9 = items.find(
      (i) => i.group === "Step 9 — Second, later appearance of the same step number",
    )!;
    expect(secondStep9.commands).toEqual([]);
  });

  it("matches a gotcha mid-paragraph, not just at the start", () => {
    const secondStep9 = items.find(
      (i) => i.group === "Step 9 — Second, later appearance of the same step number",
    )!;
    expect(secondStep9.gotchas.some((g) => g.includes("mid-paragraph mention"))).toBe(true);
  });

  it("gives an H3 sub-step its own entry with the parent H2's text as group", () => {
    const subStep = items.find((i) => i.title.includes("9a."));
    expect(subStep?.group).toBe("Step 9 — Second, later appearance of the same step number");
  });
});
