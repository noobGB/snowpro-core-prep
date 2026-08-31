/**
 * Tests for parseStudyPlan()'s optional trailing task tag ({skip-ok}/{pin-early}/{mock:1}/
 * {mock:2}/{review}) -- feeds crunch-mode compression, app/src/lib/planDates.ts (issue #76). Uses
 * an inline markdown fixture rather than the real 00_Study_Plan.md so this stays a parser-shape
 * test, not coupled to future content edits.
 */

import { describe, expect, it } from "vitest";
import { parseStudyPlan } from "../src/parsers/studyPlan.js";

const FIXTURE = `
## Day-by-day

### Mon 2026-01-05 (evening)
- [ ] Plain task with no tag.
- [ ] Optional orientation reading. {skip-ok}
- [ ] Register for the exam early. {pin-early}

### Tue 2026-01-06 — Exam day
- [ ] First full-length practice exam. {mock:1}
- [ ] Review wrong answers. {review}
- [ ] Second full-length practice exam. {mock:2}

## Progress tracker
- [ ] not part of the plan
`;

describe("parseStudyPlan — task tags", () => {
  const days = parseStudyPlan(FIXTURE);

  it("parses both days, ignoring the trailing Progress tracker section", () => {
    expect(days).toHaveLength(2);
  });

  it("defaults an untagged task to must priority with no role, and strips nothing from its text", () => {
    const task = days[0]!.tasks[0]!;
    expect(task.text).toBe("Plain task with no tag.");
    expect(task.priority).toBe("must");
    expect(task.role).toBeUndefined();
  });

  it("parses {skip-ok} as skippable priority with no structural role", () => {
    const task = days[0]!.tasks[1]!;
    expect(task.text).toBe("Optional orientation reading.");
    expect(task.priority).toBe("skippable");
    expect(task.role).toBeUndefined();
  });

  it("parses {pin-early} as a must-priority task carrying the pin-early role", () => {
    const task = days[0]!.tasks[2]!;
    expect(task.text).toBe("Register for the exam early.");
    expect(task.priority).toBe("must");
    expect(task.role).toBe("pin-early");
  });

  it("parses {mock:1}, {review}, and {mock:2} as must-priority tasks with their structural roles", () => {
    const [mock1, review, mock2] = days[1]!.tasks;
    expect(mock1!.text).toBe("First full-length practice exam.");
    expect(mock1!.priority).toBe("must");
    expect(mock1!.role).toBe("mock1");

    expect(review!.text).toBe("Review wrong answers.");
    expect(review!.role).toBe("review");

    expect(mock2!.text).toBe("Second full-length practice exam.");
    expect(mock2!.role).toBe("mock2");
  });
});
