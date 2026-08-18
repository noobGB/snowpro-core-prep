/**
 * Tests that validate.ts's structural invariant checks actually fire on a deliberately broken
 * bundle — cheap insurance that these checks aren't dead code that always passes.
 */

import { describe, expect, it } from "vitest";
import { validateBundle } from "../src/assemble/validate.js";
import { ErrorCollector } from "../src/errors.js";
import type { ContentBundle } from "../src/types.js";

function baseBundle(): ContentBundle {
  return {
    bankVersion: "sha256:test",
    generatedAt: new Date().toISOString(),
    generatedFrom: [],
    domains: [
      { id: "d1", number: 1, title: "D1", weight: 0.5, noteFile: "01.md", sections: [] },
      { id: "d2", number: 2, title: "D2", weight: 0.5, noteFile: "02.md", sections: [] },
    ],
    questions: [
      {
        id: "d1-q1",
        domainId: "d1",
        type: "single",
        stem: "s",
        options: [{ key: "A", text: "a" }],
        correct: ["A"],
        explanation: "e",
        sourceFile: "10.md",
        sourceIndex: 1,
      },
    ],
    sets: [
      { id: "set-d1", kind: "domain", domainId: "d1", title: "Set", questionIds: ["d1-q1"], timed: false },
    ],
    flashcards: [],
    plan: [],
    resources: [],
    setup: [],
  };
}

describe("validateBundle", () => {
  it("passes a well-formed bundle with no errors", () => {
    const collector = new ErrorCollector();
    validateBundle(baseBundle(), collector);
    expect(collector.hasErrors).toBe(false);
  });

  it("catches a set referencing a question id that doesn't exist", () => {
    const bundle = baseBundle();
    bundle.sets[0]!.questionIds.push("d1-q99");
    const collector = new ErrorCollector();
    validateBundle(bundle, collector);
    expect(collector.hasErrors).toBe(true);
    expect(collector.all.some((e) => e.message.includes("d1-q99"))).toBe(true);
  });

  it("catches a question with a domainId that doesn't exist", () => {
    const bundle = baseBundle();
    bundle.questions[0]!.domainId = "d99";
    const collector = new ErrorCollector();
    validateBundle(bundle, collector);
    expect(collector.hasErrors).toBe(true);
  });

  it("catches duplicate question ids", () => {
    const bundle = baseBundle();
    bundle.questions.push({ ...bundle.questions[0]! });
    const collector = new ErrorCollector();
    validateBundle(bundle, collector);
    expect(collector.hasErrors).toBe(true);
    expect(collector.all.some((e) => e.message.includes("duplicate id"))).toBe(true);
  });

  it("catches domain weights that don't sum to 1.0", () => {
    const bundle = baseBundle();
    bundle.domains[0]!.weight = 0.9;
    const collector = new ErrorCollector();
    validateBundle(bundle, collector);
    expect(collector.hasErrors).toBe(true);
  });

  it("catches a setup item with no summary (missing/mislabeled '> **Summary:**' blockquote)", () => {
    const bundle = baseBundle();
    bundle.setup.push({
      id: "s-step-1",
      kind: "step",
      group: "Step 1 — Test",
      title: "Step 1 — Test",
      summary: "",
      commands: [],
      sourceAnchor: "step-1--test",
    });
    const collector = new ErrorCollector();
    validateBundle(bundle, collector);
    expect(collector.hasErrors).toBe(true);
    expect(collector.all.some((e) => e.message.includes("no") && e.message.includes("Summary"))).toBe(true);
  });

  it("catches a mock set whose stored domainSplit doesn't match its own questionIds", () => {
    const bundle = baseBundle();
    bundle.sets.push({
      id: "mock-1",
      kind: "mock",
      title: "Mock",
      questionIds: ["d1-q1"],
      timed: true,
      durationMin: 115,
      domainSplit: { d1: 5 }, // wrong — only 1 question actually references d1
    });
    const collector = new ErrorCollector();
    validateBundle(bundle, collector);
    expect(collector.hasErrors).toBe(true);
    expect(collector.all.some((e) => e.message.includes("domainSplit mismatch"))).toBe(true);
  });
});
