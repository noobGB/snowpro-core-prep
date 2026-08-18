/**
 * Tests for setupLog.ts against its real structure: two top-level sections ("## Setup Steps",
 * "## Known Issues & Fixes") that set each entry's `kind`, a leading "## Status" section that
 * isn't either and is skipped, a required "> **Summary:**" blockquote per entry, and stable
 * file-order ids even across a section boundary.
 */

import { describe, expect, it } from "vitest";
import { parseSetupLog } from "../src/parsers/setupLog.js";

const FIXTURE = `# Setup log fixture

## Status

Some running status text that isn't a step or an issue.

## Setup Steps

### Step 1 — First step

> **Summary:** Do the first thing.

Some body text.

\`\`\`sql
SELECT 1;
\`\`\`

### Step 2 — Second step, has a sub-step

> **Summary:** Do the second thing.

Body text.

\`\`\`
plain untagged output, not a command
\`\`\`

#### 2a. A sub-step under Step 2

> **Summary:** Do the sub-thing.

Sub-step body.

## Known Issues & Fixes

### Issue 1 — Something went wrong

> **Summary:** It broke, here's why.

Full narrative about what broke.
`;

describe("parseSetupLog", () => {
  const items = parseSetupLog(FIXTURE);

  it("skips the leading ## Status section entirely", () => {
    expect(items.some((i) => i.title.includes("Status"))).toBe(false);
  });

  it("tags Setup Steps entries with kind 'step'", () => {
    const step1 = items.find((i) => i.title === "Step 1 — First step")!;
    expect(step1.kind).toBe("step");
  });

  it("tags Known Issues entries with kind 'issue'", () => {
    const issue1 = items.find((i) => i.title === "Issue 1 — Something went wrong")!;
    expect(issue1.kind).toBe("issue");
  });

  it("assigns stable, unique, file-order ids across the section boundary", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    const ids = items.map((i) => i.id);
    const step2Idx = ids.indexOf(items.find((i) => i.title.startsWith("Step 2"))!.id);
    const issue1Idx = ids.indexOf(items.find((i) => i.title.startsWith("Issue 1"))!.id);
    expect(step2Idx).toBeLessThan(issue1Idx);
  });

  it("extracts the '> **Summary:**' blockquote, stripping the label", () => {
    const step1 = items.find((i) => i.title === "Step 1 — First step")!;
    expect(step1.summary).toBe("Do the first thing.");
  });

  it("captures a language-tagged fenced code block as a command", () => {
    const step1 = items.find((i) => i.title === "Step 1 — First step")!;
    expect(step1.commands).toEqual(["SELECT 1;"]);
  });

  it("excludes an untagged fenced code block from commands", () => {
    const step2 = items.find((i) => i.title.startsWith("Step 2"))!;
    expect(step2.commands).toEqual([]);
  });

  it("gives an H4 sub-step its own entry, inheriting kind and the parent H3's title as group", () => {
    const subStep = items.find((i) => i.title.includes("2a."));
    expect(subStep?.group).toBe("Step 2 — Second step, has a sub-step");
    expect(subStep?.kind).toBe("step");
    expect(subStep?.summary).toBe("Do the sub-thing.");
  });

  it("slugifies the title into a GitHub-style sourceAnchor", () => {
    const step1 = items.find((i) => i.title === "Step 1 — First step")!;
    expect(step1.sourceAnchor).toBe("step-1--first-step");
  });
});
