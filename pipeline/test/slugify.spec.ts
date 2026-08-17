/**
 * Tests for slugify() against the two real edge cases found in the domain-notes files: a
 * heading with a code span (backticks must be stripped, not leak into the anchor) and a
 * heading with an apostrophe (stripped outright, not hyphenated).
 */

import { describe, expect, it } from "vitest";
import { slugify, stripMdSyntax } from "../src/util/slugify.js";

describe("stripMdSyntax", () => {
  it("removes code-span backticks while keeping the inner text", () => {
    expect(stripMdSyntax("`COPY INTO` and error handling")).toBe("COPY INTO and error handling");
  });

  it("removes bold/italic markers while keeping the inner text", () => {
    expect(stripMdSyntax("**bold** and *italic*")).toBe("bold and italic");
  });
});

describe("slugify", () => {
  it("produces a clean anchor for a heading with a code span", () => {
    expect(slugify("`COPY INTO` and error handling")).toBe("copy-into-and-error-handling");
  });

  it("strips an apostrophe without inserting a hyphen", () => {
    expect(slugify("Snowflake's data sharing capabilities")).toBe(
      "snowflakes-data-sharing-capabilities",
    );
  });

  it("lowercases and hyphenates ordinary punctuation/whitespace", () => {
    expect(slugify("Table types vs. Time Travel / Fail-safe")).toBe(
      "table-types-vs-time-travel-fail-safe",
    );
  });
});
