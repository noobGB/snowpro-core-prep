/**
 * Tests for setupLog.ts against its real structure: two top-level sections ("## Setup Steps",
 * "## Known Issues & Fixes") that set each entry's `kind`, a leading "## Status" section that
 * isn't either and is skipped, a required "> **Summary:**" blockquote per entry, and
 * content-derived ids that survive reordering/reclassifying entries -- the exact property a real
 * review finding showed positional ids didn't have (a reorder silently reassigned old ids to
 * different content; a saved progress.setup.checked id could point at the wrong entry with no
 * error anywhere). The "assigns ids from an explicit map, not relative ordering" test below is
 * deliberately an exact-value assertion, not a relative one, since `id` is the actual persisted
 * progress key -- an exact-value test is what would have caught that regression at review time.
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

  it("assigns unique ids across the section boundary", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it("assigns ids from an explicit map, not relative ordering -- id is the persisted progress key", () => {
    expect(Object.fromEntries(items.map((i) => [i.title, i.id]))).toEqual({
      "Step 1 — First step": "s-step-1--first-step",
      "Step 2 — Second step, has a sub-step": "s-step-2--second-step-has-a-sub-step",
      "2a. A sub-step under Step 2": "s-2a-a-sub-step-under-step-2",
      "Issue 1 — Something went wrong": "s-issue-1--something-went-wrong",
    });
  });

  it("keeps an entry's id stable when unrelated entries are reordered/reclassified around it", () => {
    // Same "Step 1" content, but with Setup Steps and Known Issues swapped and Step 2 dropped --
    // simulates exactly the kind of restructure that broke positional ids once already.
    const reordered = parseSetupLog(`# Fixture
## Known Issues & Fixes
### Issue 1 — Something went wrong
> **Summary:** It broke, here's why.
## Setup Steps
### Step 1 — First step
> **Summary:** Do the first thing.
`);
    const step1 = reordered.find((i) => i.title === "Step 1 — First step");
    expect(step1?.id).toBe("s-step-1--first-step"); // unchanged despite moving to file position 2
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
