/**
 * Tests for the shared question/answer-key state machine, focused on the fiddly bits found
 * against the real files: option-line-wrap merging, answer-key continuation lines whose indent
 * width varies with the entry number's digit count, and multi-select letter splitting.
 */

import { describe, expect, it } from "vitest";
import { ErrorCollector } from "../src/errors.js";
import { parseQuestionFile } from "../src/parsers/questionCore.js";

const BASIC_FIXTURE = `# Fixture

Intro paragraph.

---

**1.** A short stem
that wraps onto a second line before the options.

A. Short option
B. A long option that wraps onto an indented
   continuation line right here
C. Another option
D. Last option

**2. (Select TWO)** Multi-select stem.

A. Alpha
B. Beta
C. Gamma
D. Delta

---

## Answer Key & Explanations

1. **B.** Explanation one.
2. **A and C.** Explanation two that
   continues here on a 3-space indent.
`;

describe("parseQuestionFile — basics", () => {
  it("has no parse errors on well-formed input", () => {
    const collector = new ErrorCollector();
    parseQuestionFile(BASIC_FIXTURE, "fixture.md", collector);
    expect(collector.hasErrors).toBe(false);
  });

  it("merges a wrapped option's continuation line back onto the option text", () => {
    const collector = new ErrorCollector();
    const questions = parseQuestionFile(BASIC_FIXTURE, "fixture.md", collector);
    const optionB = questions.find((q) => q.number === 1)!.options.find((o) => o.key === "B")!;
    expect(optionB.text).toBe(
      "A long option that wraps onto an indented continuation line right here",
    );
  });

  it("collects a multi-line stem into a single space-joined string", () => {
    const collector = new ErrorCollector();
    const questions = parseQuestionFile(BASIC_FIXTURE, "fixture.md", collector);
    expect(questions.find((q) => q.number === 1)!.stem).toBe(
      "A short stem that wraps onto a second line before the options.",
    );
  });

  it("joins an answer-key explanation's continuation line regardless of its indent width", () => {
    const collector = new ErrorCollector();
    const questions = parseQuestionFile(BASIC_FIXTURE, "fixture.md", collector);
    expect(questions.find((q) => q.number === 2)!.explanation).toBe(
      "Explanation two that continues here on a 3-space indent.",
    );
  });

  it("splits an 'A and C' answer-key entry into two correct letters and marks the question multi-select", () => {
    const collector = new ErrorCollector();
    const questions = parseQuestionFile(BASIC_FIXTURE, "fixture.md", collector);
    const q2 = questions.find((q) => q.number === 2)!;
    expect(q2.correct).toEqual(["A", "C"]);
    expect(q2.multiSelect).toBe(true);
  });
});

const INDENT_WIDTH_FIXTURE = `# Fixture

---

**9.** Nine stem.

A. a
B. b
C. c
D. d

**10.** Ten stem.

A. a
B. b
C. c
D. d

---

## Answer Key & Explanations

9. **A.** A nine-digit entry whose continuation
   uses a 3-space indent.
10. **B.** A ten-digit entry whose continuation
    uses a 4-space indent — must not matter.
`;

describe("parseQuestionFile — answer-key indent width", () => {
  it("parses both a 1-digit and a 2-digit entry's continuation without a fixed indent assumption", () => {
    const collector = new ErrorCollector();
    const questions = parseQuestionFile(INDENT_WIDTH_FIXTURE, "fixture.md", collector);
    expect(collector.hasErrors).toBe(false);
    expect(questions.find((q) => q.number === 9)!.explanation).toBe(
      "A nine-digit entry whose continuation uses a 3-space indent.",
    );
    expect(questions.find((q) => q.number === 10)!.explanation).toBe(
      "A ten-digit entry whose continuation uses a 4-space indent — must not matter.",
    );
  });
});
