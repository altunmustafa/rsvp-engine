import { afterEach, describe, expect, it, vi } from "vitest";

import { DefaultOvpStrategy } from "./default-ovp-strategy";

describe("DefaultOvpStrategy", () => {
  const strategy = new DefaultOvpStrategy();

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

    const fallback = new DefaultOvpStrategy();
    expect(fallback.calculate("👩‍💻coding")).toBe(5);
    expect(fallback.calculate("e\u0301clair")).toBe(2);
  });

  it("uses the grapheme fallback when Intl itself is unavailable", () => {
    vi.stubGlobal("Intl", undefined);

    const fallback = new DefaultOvpStrategy();
    expect(fallback.calculate("👩‍💻coding")).toBe(5);
    expect(fallback.calculate("e\u0301clair")).toBe(2);
  });

  it("reuses one grapheme segmenter across words and independent calculations", () => {
    const NativeSegmenter = Intl.Segmenter;
    const createSegmenter = vi.spyOn(Intl, "Segmenter").mockImplementation(function (...args) {
      return new NativeSegmenter(...args);
    });
    const reusable = new DefaultOvpStrategy();
    expect(reusable.calculate("hello")).toBe(1);
    expect(reusable.calculate("👩‍💻coding")).toBe(5);
    expect(reusable.calculate("e\u0301clair")).toBe(2);
    expect(createSegmenter).toHaveBeenCalledOnce();
    expect(createSegmenter).toHaveBeenCalledWith(undefined, { granularity: "grapheme" });
  });
});
