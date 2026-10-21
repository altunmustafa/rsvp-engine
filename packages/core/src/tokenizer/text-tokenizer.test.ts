import type { OvpStrategy } from "./types";

import { afterEach, describe, expect, it, vi } from "vitest";

import { InvalidInputError } from "../errors";

import { TextTokenizer } from "./text-tokenizer";

describe("TextTokenizer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("string inputs", () => {
    const tokenizer = new TextTokenizer();

    it("returns empty array for empty string", () => {
      expect(tokenizer.tokenize("")).toEqual([]);
    });

    it("returns empty array for whitespace-only string", () => {
      expect(tokenizer.tokenize("   \n \t  ")).toEqual([]);
    });

    it("returns a single token for a single word", () => {
      const tokens = tokenizer.tokenize("Hello");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ value: "Hello" });
    });

    it("tokenizes a simple sentence correctly", () => {
      const tokens = tokenizer.tokenize("Hello world");
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ value: "Hello" });
      expect(tokens[1]).toMatchObject({ value: "world" });
    });

    it("handles multiple spaces/tabs/newlines correctly", () => {
      const tokens = tokenizer.tokenize("Hello \n\t  world");
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ value: "Hello" });
      expect(tokens[1]).toMatchObject({ value: "world" });
    });

    it("assigns correct duration multipliers based on trailing punctuation", () => {
      const tokens = tokenizer.tokenize("Wait. Here, now? Yes! dash— end");
      expect(tokens).toHaveLength(6);
      expect(tokens[0]).toMatchObject({ value: "Wait.", durationMultiplier: 2.0 });
      expect(tokens[1]).toMatchObject({ value: "Here,", durationMultiplier: 1.5 });
      expect(tokens[2]).toMatchObject({ value: "now?", durationMultiplier: 2.0 });
      expect(tokens[3]).toMatchObject({ value: "Yes!", durationMultiplier: 2.0 });
      expect(tokens[4]).toMatchObject({ value: "dash—", durationMultiplier: 1.3 });
      expect(tokens[5]).toMatchObject({ value: "end", durationMultiplier: 1.0 });
    });

    it("segments text arrays in order without mutating input", () => {
      const input = ["Hello world.", "", "  ", "Again, please!"];
      const tokens = tokenizer.tokenize(input);
      expect(tokens.map(({ value }) => value)).toEqual(["Hello", "world.", "Again,", "please!"]);
      expect(input).toEqual(["Hello world.", "", "  ", "Again, please!"]);
      expect(tokenizer.tokenize([])).toEqual([]);
    });

    it("keeps unfinished punctuation within its own text", () => {
      expect(tokenizer.tokenize(['say "', "hello"]).map(({ value }) => value)).toEqual([
        "say",
        '"',
        "hello",
      ]);
    });

    it("works with unicode characters correctly", () => {
      const tokens = tokenizer.tokenize("çğıöşü");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ value: "çğıöşü", ovpIndex: 1 });
    });

    it("handles extreme punctuation correctly", () => {
      const tokens = tokenizer.tokenize("Hello... World!?!");
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ value: "Hello...", durationMultiplier: 2.0 });
      expect(tokens[1]).toMatchObject({ value: "World!?!", durationMultiplier: 2.0 });
    });

    it("segments CJK text and recognizes Unicode punctuation", () => {
      const tokens = tokenizer.tokenize("你好世界。下一句！");

      expect(tokens.length).toBeGreaterThan(1);
      expect(tokens.at(-1)?.durationMultiplier).toBe(2);
      expect(tokens.some(({ value }) => value.includes("。"))).toBe(true);
    });

    it("keeps emoji grapheme clusters intact", () => {
      const tokens = tokenizer.tokenize("👩‍💻 coding");

      expect(tokens[0]?.value).toBe("👩‍💻");
    });

    it("associates opening punctuation with the following word", () => {
      expect(tokenizer.tokenize('say "Hello"')).toMatchObject([
        { value: "say" },
        { value: '"Hello"' },
      ]);
      expect(tokenizer.tokenize("…")).toMatchObject([{ value: "…", durationMultiplier: 2 }]);
      expect(tokenizer.tokenize("hello … world")).toMatchObject([
        { value: "hello" },
        { value: "…", durationMultiplier: 2 },
        { value: "world" },
      ]);
    });

    it("falls back to whitespace tokenization without Intl.Segmenter", () => {
      vi.stubGlobal("Intl", {});
      const fallbackTokenizer = new TextTokenizer();

      expect(fallbackTokenizer.tokenize("hello   world")).toMatchObject([
        { value: "hello" },
        { value: "world" },
      ]);
    });

    it("falls back to whitespace tokenization without Intl", () => {
      vi.stubGlobal("Intl", undefined);
      const fallbackTokenizer = new TextTokenizer();

      expect(fallbackTokenizer.tokenize("hello   world")).toMatchObject([
        { value: "hello" },
        { value: "world" },
      ]);
    });
  });

  describe("configuration", () => {
    it("uses an injected OVP strategy for string tokens", () => {
      class LastCharacterOvpStrategy implements OvpStrategy {
        public calculate(text: string): number {
          return Math.max(0, text.length - 1);
        }
      }

      const tokenizer = new TextTokenizer({
        ovpStrategy: new LastCharacterOvpStrategy(),
      });

      expect(tokenizer.tokenize("Hello world")).toMatchObject([
        { value: "Hello", ovpIndex: 4 },
        { value: "world", ovpIndex: 4 },
      ]);
      expect(tokenizer.tokenize(["Hi", "there"])).toMatchObject([
        { value: "Hi", ovpIndex: 1 },
        { value: "there", ovpIndex: 4 },
      ]);
    });

    it("rejects invalid duration multipliers", () => {
      expect(() => new TextTokenizer({ sentenceDurationMultiplier: 0 })).toThrow(InvalidInputError);
      expect(() => new TextTokenizer({ clauseDurationMultiplier: Number.NaN })).toThrow(
        InvalidInputError,
      );
      expect(() => new TextTokenizer({ dashDurationMultiplier: Number.POSITIVE_INFINITY })).toThrow(
        InvalidInputError,
      );
    });

    it("accepts custom duration multiplier options", () => {
      const customTok = new TextTokenizer({
        sentenceDurationMultiplier: 3.5,
        clauseDurationMultiplier: 2.2,
        dashDurationMultiplier: 1.8,
      });
      const tokens = customTok.tokenize("Wait. Here, dash—");
      expect(tokens[0]).toMatchObject({ value: "Wait.", durationMultiplier: 3.5 });
      expect(tokens[1]).toMatchObject({ value: "Here,", durationMultiplier: 2.2 });
      expect(tokens[2]).toMatchObject({ value: "dash—", durationMultiplier: 1.8 });
    });
  });

  it.each(
    [null, undefined, 42, {}, ["text", 42], [["nested"]], [null], Array(1)].map((input) => ({
      input,
    })),
  )("rejects invalid runtime input $input", ({ input }) => {
    const tokenizer = new TextTokenizer();
    expect(() => tokenizer.tokenize(input as string)).toThrow(InvalidInputError);
  });
});
