/**
 * Tests for theme.ts's pure resolution logic and its one DOM-touching function.
 * resolveThemeAttribute() is what both the pre-paint script in index.html and App.tsx's effect
 * key off of — "system" must resolve to undefined (no attribute set at all) rather than a literal
 * "system" string, since tokens.css only has selectors for data-theme="light"/"dark"; a stray
 * data-theme="system" attribute would silently fall through to no override, same visual bug as
 * forgetting to handle "system" at all but harder to notice in a diff.
 */

import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, resolveThemeAttribute } from "./theme";

describe("resolveThemeAttribute", () => {
  it("resolves 'dark' to 'dark'", () => {
    expect(resolveThemeAttribute("dark")).toBe("dark");
  });

  it("resolves 'light' to 'light'", () => {
    expect(resolveThemeAttribute("light")).toBe("light");
  });

  it("resolves 'system' to undefined, not the string 'system'", () => {
    expect(resolveThemeAttribute("system")).toBeUndefined();
  });
});

describe("applyTheme", () => {
  // theme.ts is the only module that touches the DOM. Rather than pull in jsdom for one attribute
  // check, stub just enough of `document` to observe what applyTheme actually does:
  // set/remove documentElement.dataset.theme.
  function fakeDocumentElement() {
    return { dataset: {} as Record<string, string> };
  }

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).document;
  });

  it("sets data-theme='light' for theme 'light'", () => {
    const documentElement = fakeDocumentElement();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = { documentElement };
    applyTheme("light");
    expect(documentElement.dataset.theme).toBe("light");
  });

  it("sets data-theme='dark' for theme 'dark'", () => {
    const documentElement = fakeDocumentElement();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = { documentElement };
    applyTheme("dark");
    expect(documentElement.dataset.theme).toBe("dark");
  });

  it("removes a stale data-theme attribute for theme 'system' rather than leaving it set", () => {
    const documentElement = fakeDocumentElement();
    documentElement.dataset.theme = "light"; // simulate a previous explicit selection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).document = { documentElement };
    applyTheme("system");
    expect(documentElement.dataset.theme).toBeUndefined();
  });
});
