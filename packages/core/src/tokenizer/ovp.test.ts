import { afterEach, describe, expect, it, vi } from "vitest";

import { DefaultOVPStrategy } from "./ovp";

describe("DefaultOVPStrategy", () => {
  const strategy = new DefaultOVPStrategy();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns zero for empty text", () => {
    expect(strategy.calculate("")).toBe(0);
  });

  it.for([
    { input: "a", expectedIndex: 0, expectedGrapheme: "a" },
    { input: "at", expectedIndex: 0, expectedGrapheme: "a" },
    { input: "cat", expectedIndex: 0, expectedGrapheme: "c" },
    { input: "the", expectedIndex: 0, expectedGrapheme: "t" },
    { input: "Hello", expectedIndex: 1, expectedGrapheme: "e" },
    { input: "presentation", expectedIndex: 3, expectedGrapheme: "s" },
    { input: "Hello!", expectedIndex: 1, expectedGrapheme: "e" },
    { input: "Wait...", expectedIndex: 1, expectedGrapheme: "a" },
    { input: "cat!", expectedIndex: 0, expectedGrapheme: "c" },
    { input: '"Hello"', expectedIndex: 2, expectedGrapheme: "e" },
    { input: "👩‍💻coding", expectedIndex: 5, expectedGrapheme: "c" },
    { input: "e\u0301clair", expectedIndex: 2, expectedGrapheme: "c" },
  ])(
    "selects '$expectedGrapheme' at UTF-16 offset $expectedIndex in '$input'",
    ({ input, expectedIndex, expectedGrapheme }) => {
      const index = strategy.calculate(input);

      expect(index).toBe(expectedIndex);
      expect(input.startsWith(expectedGrapheme, index)).toBe(true);
    },
  );

  it("returns the punctuation index when text has no readable graphemes", () => {
    expect(strategy.calculate("…")).toBe(0);
  });

  it("uses a dependency-free grapheme fallback when Intl.Segmenter is unavailable", () => {
    vi.stubGlobal("Intl", {});

    expect(strategy.calculate("👩‍💻coding")).toBe(5);
    expect(strategy.calculate("e\u0301clair")).toBe(2);
  });

  it("uses the grapheme fallback when Intl itself is unavailable", () => {
    vi.stubGlobal("Intl", undefined);

    expect(strategy.calculate("👩‍💻coding")).toBe(5);
    expect(strategy.calculate("e\u0301clair")).toBe(2);
  });
});
