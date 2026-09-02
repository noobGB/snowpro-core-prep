/**
 * Tests for mockExam.ts's domain-resolution pass: stem-normalized dedup against the domain-file
 * question pool takes precedence over an inline [Dx] tag when both are present (dedup is the
 * ground-truth signal), a question with only a tag mints a new mock-only id, and a question with
 * neither is collected — not thrown — so a run can report every unresolved question at once.
 */

import { describe, expect, it } from "vitest";
import { ErrorCollector } from "../src/errors.js";
import { parseMockExam, parseMockMeta } from "../src/parsers/mockExam.js";
import type { Question } from "../src/types.js";

const domainPool: Question[] = [
  {
    id: "d1-q1",
    domainId: "d1",
    type: "single",
    stem: "What is the capital of Testland?",
    options: [
      { key: "A", text: "Foo" },
      { key: "B", text: "Bar" },
    ],
    correct: ["A"],
    explanation: "Foo is correct.",
    sourceFile: "10_Practice_Questions_Domain1_Architecture.md",
    sourceIndex: 1,
  },
];

function mockFile(body: string): string {
  return `# Mock Exam 1

Intro.

---

${body}

---

## Answer Key & Explanations

`;
}

describe("parseMockExam", () => {
  it("prefers a dedup match over an inline tag when both are present on the same question", () => {
    const raw = mockFile(`**1. [D5]** What is the capital of Testland?

A. Foo
B. Bar

`) + `1. **A.** Foo is correct.\n`;
    const collector = new ErrorCollector();
    const result = parseMockExam(raw, "17_Mock_Exam_2.md", 2, domainPool, collector);
    expect(collector.hasErrors).toBe(false);
    expect(result.newQuestions).toHaveLength(0); // reused the existing domain-file question, not minted
    expect(result.questionIdsInOrder).toEqual(["d1-q1"]);
  });

  it("mints a new mock-only question from an inline tag when there is no dedup match", () => {
    const raw =
      mockFile(`**1. [D3]** A brand new question never seen before.

A. Foo
B. Bar

`) + `1. **B.** Bar is correct.\n`;
    const collector = new ErrorCollector();
    const result = parseMockExam(raw, "17_Mock_Exam_2.md", 2, domainPool, collector);
    expect(collector.hasErrors).toBe(false);
    expect(result.newQuestions).toHaveLength(1);
    expect(result.newQuestions[0]!.id).toBe("mock2-q1");
    expect(result.newQuestions[0]!.domainId).toBe("d3");
    expect(result.questionIdsInOrder).toEqual(["mock2-q1"]);
  });

  it("collects an unresolved-domain error (not a thrown exception) for a question with neither a dedup match nor a tag", () => {
    const raw =
      mockFile(`**1.** A question with no dedup match and no tag.

A. Foo
B. Bar

`) + `1. **A.** Foo is correct.\n`;
    const collector = new ErrorCollector();
    const result = parseMockExam(raw, "17_Mock_Exam_2.md", 2, domainPool, collector);
    expect(collector.hasErrors).toBe(true);
    expect(collector.all[0]!.kind).toBe("unresolved-domain");
    expect(result.questionIdsInOrder).toEqual([]);
  });
});

describe("parseMockMeta", () => {
  it("assigns the confirmed 1-2 easy / 3 medium / 4-5 hard progression", () => {
    const raw = mockFile("");
    expect(parseMockMeta(raw, 1).difficulty).toBe("easy");
    expect(parseMockMeta(raw, 2).difficulty).toBe("easy");
    expect(parseMockMeta(raw, 3).difficulty).toBe("medium");
    expect(parseMockMeta(raw, 4).difficulty).toBe("hard");
    expect(parseMockMeta(raw, 5).difficulty).toBe("hard");
  });

  it("falls back to medium for any mock number beyond the documented five", () => {
    expect(parseMockMeta(mockFile(""), 6).difficulty).toBe("medium");
  });
});
