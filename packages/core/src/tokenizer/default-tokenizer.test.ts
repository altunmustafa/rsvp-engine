import type { OVPStrategy } from "./types";

import { afterEach, describe, expect, it, vi } from "vitest";

import { InvalidInputError } from "../errors";

import { DefaultTokenizer } from "./default-tokenizer";

describe("DefaultTokenizer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("string inputs", () => {
    const tokenizer = new DefaultTokenizer<string>();

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

    it("assigns correct delay multipliers based on trailing punctuation", () => {
      const tokens = tokenizer.tokenize("Wait. Here, now? Yes! dash— end");
      expect(tokens).toHaveLength(6);
      expect(tokens[0]).toMatchObject({ value: "Wait.", delayMultiplier: 2.0 });
      expect(tokens[1]).toMatchObject({ value: "Here,", delayMultiplier: 1.5 });
      expect(tokens[2]).toMatchObject({ value: "now?", delayMultiplier: 2.0 });
      expect(tokens[3]).toMatchObject({ value: "Yes!", delayMultiplier: 2.0 });
      expect(tokens[4]).toMatchObject({ value: "dash—", delayMultiplier: 1.3 });
      expect(tokens[5]).toMatchObject({ value: "end", delayMultiplier: 1.0 });
    });

    it("handles array input T[] correctly", () => {
      const input = ["Hello", "world"];
      const tokens = tokenizer.tokenize(input);
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ value: "Hello" });
      expect(tokens[1]).toMatchObject({ value: "world" });
    });

    it("works with unicode characters correctly", () => {
      const tokens = tokenizer.tokenize("çğıöşü");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ value: "çğıöşü", ovpIndex: 1 });
    });

    it("handles extreme punctuation correctly", () => {
      const tokens = tokenizer.tokenize("Hello... World!?!");
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ value: "Hello...", delayMultiplier: 2.0 });
      expect(tokens[1]).toMatchObject({ value: "World!?!", delayMultiplier: 2.0 });
    });

    it("segments CJK text and recognizes Unicode punctuation", () => {
      const tokens = tokenizer.tokenize("你好世界。下一句！");

      expect(tokens.length).toBeGreaterThan(1);
      expect(tokens.at(-1)?.delayMultiplier).toBe(2);
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
      expect(tokenizer.tokenize("…")).toMatchObject([{ value: "…", delayMultiplier: 2 }]);
      expect(tokenizer.tokenize("hello … world")).toMatchObject([
        { value: "hello" },
        { value: "…", delayMultiplier: 2 },
        { value: "world" },
      ]);
    });

    it("falls back to whitespace tokenization without Intl.Segmenter", () => {
      vi.stubGlobal("Intl", {});
      const fallbackTokenizer = new DefaultTokenizer<string>();

      expect(fallbackTokenizer.tokenize("hello   world")).toMatchObject([
        { value: "hello" },
        { value: "world" },
      ]);
    });

    it("falls back to whitespace tokenization without Intl", () => {
      vi.stubGlobal("Intl", undefined);
      const fallbackTokenizer = new DefaultTokenizer<string>();

      expect(fallbackTokenizer.tokenize("hello   world")).toMatchObject([
        { value: "hello" },
        { value: "world" },
      ]);
    });
  });

  describe("configuration", () => {
    it("uses an injected OVP strategy for string tokens", () => {
      class LastCharacterOVPStrategy implements OVPStrategy {
        public calculate(text: string): number {
          return Math.max(0, text.length - 1);
        }
      }

      const tokenizer = new DefaultTokenizer<string>({
        ovpStrategy: new LastCharacterOVPStrategy(),
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

    it("rejects invalid delay multipliers", () => {
      expect(() => new DefaultTokenizer<string>({ sentenceDelay: 0 })).toThrow(InvalidInputError);
      expect(() => new DefaultTokenizer<string>({ clauseDelay: Number.NaN })).toThrow(
        InvalidInputError,
      );
      expect(() => new DefaultTokenizer<string>({ dashDelay: Number.POSITIVE_INFINITY })).toThrow(
        InvalidInputError,
      );
    });

    it("uses default option values when none are provided", () => {
      const defaultTok = new DefaultTokenizer<string>();
      const tokens = defaultTok.tokenize("Wait. Here, dash—");
      expect(tokens[0]).toMatchObject({ value: "Wait.", delayMultiplier: 2.0 });
      expect(tokens[1]).toMatchObject({ value: "Here,", delayMultiplier: 1.5 });
      expect(tokens[2]).toMatchObject({ value: "dash—", delayMultiplier: 1.3 });
    });

    it("accepts custom delay multiplier options", () => {
      const customTok = new DefaultTokenizer<string>({
        sentenceDelay: 3.5,
        clauseDelay: 2.2,
        dashDelay: 1.8,
      });
      const tokens = customTok.tokenize("Wait. Here, dash—");
      expect(tokens[0]).toMatchObject({ value: "Wait.", delayMultiplier: 3.5 });
      expect(tokens[1]).toMatchObject({ value: "Here,", delayMultiplier: 2.2 });
      expect(tokens[2]).toMatchObject({ value: "dash—", delayMultiplier: 1.8 });
    });
  });

  describe("typed item inputs", () => {
    it("treats non-string non-array primitive as a single token item", () => {
      const tokenizer = new DefaultTokenizer<number>();
      const tokens = tokenizer.tokenize(123);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ value: 123, ovpIndex: 0, delayMultiplier: 1.0 });
    });

    it("handles generic custom objects T[]", () => {
      interface FlashCard {
        id: number;
        front: string;
        back: string;
      }
      const cards: FlashCard[] = [
        { id: 1, front: "Apple", back: "Elma" },
        { id: 2, front: "Book", back: "Kitap" },
      ];
      const genericTokenizer = new DefaultTokenizer<FlashCard>();
      const tokens = genericTokenizer.tokenize(cards);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toEqual({ id: 1, front: "Apple", back: "Elma" });
      expect(tokens[1].value).toEqual({ id: 2, front: "Book", back: "Kitap" });
    });

    it("handles generic numbers T[]", () => {
      const numberTokenizer = new DefaultTokenizer<number>();
      const tokens = numberTokenizer.tokenize([10, 20, 30]);

      expect(tokens).toHaveLength(3);
      expect(tokens[0].value).toBe(10);
      expect(tokens[1].value).toBe(20);
      expect(tokens[2].value).toBe(30);
    });

    it("handles single generic item T (e.g. single image/object)", () => {
      interface ImageItem {
        src: string;
        alt: string;
      }
      const singleImage: ImageItem = { src: "photo.jpg", alt: "Sunset" };
      const imageTokenizer = new DefaultTokenizer<ImageItem>();
      const tokens = imageTokenizer.tokenize(singleImage);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ value: singleImage, ovpIndex: 0, delayMultiplier: 1.0 });
    });

    it("allows a single instance with a union type to tokenize different types over time", () => {
      type UniversalItem = string | number | { key: string };
      const universalTokenizer = new DefaultTokenizer<UniversalItem>();

      const textTokens = universalTokenizer.tokenize("Hello world");
      expect(textTokens).toHaveLength(2);
      expect(textTokens[0].value).toBe("Hello");

      const numberTokens = universalTokenizer.tokenize([100, 200]);
      expect(numberTokens).toHaveLength(2);
      expect(numberTokens[0].value).toBe(100);

      const singleItemTokens = universalTokenizer.tokenize({ key: "val" });
      expect(singleItemTokens).toHaveLength(1);
      expect(singleItemTokens[0].value).toEqual({ key: "val" });
    });
  });

  describe("mixed and nested inputs", () => {
    type MixedItem = string | number | { src: string };

    it("recursively tokenizes nested strings and arrays when nestedTokenize is true", () => {
      const tokenizer = new DefaultTokenizer<MixedItem>({ nestedTokenize: true });
      const mixedInput: MixedItem[] = ["The quick brown fox.", 123, { src: "fox.jpg" }];

      const tokens = tokenizer.tokenize(mixedInput);
      expect(tokens).toHaveLength(6);
      expect(tokens[0]).toMatchObject({ value: "The", ovpIndex: 0 });
      expect(tokens[1]).toMatchObject({ value: "quick", ovpIndex: 1 });
      expect(tokens[2]).toMatchObject({ value: "brown", ovpIndex: 1 });
      expect(tokens[3]).toMatchObject({ value: "fox.", ovpIndex: 0, delayMultiplier: 2.0 });
      expect(tokens[4]).toEqual({ value: 123, ovpIndex: 0, delayMultiplier: 1.0 });
      expect(tokens[5]).toEqual({ value: { src: "fox.jpg" }, ovpIndex: 0, delayMultiplier: 1.0 });
    });

    it("handles deeply nested arrays when nestedTokenize is true", () => {
      type NestedItem = string | { item: number } | NestedItem[];
      const tokenizer = new DefaultTokenizer<NestedItem>({ nestedTokenize: true });
      const nestedInput: NestedItem[] = [["Hello world", "foo"], [{ item: 1 }]];

      const tokens = tokenizer.tokenize(nestedInput);
      expect(tokens).toHaveLength(4);
      expect(tokens[0]).toMatchObject({ value: "Hello" });
      expect(tokens[1]).toMatchObject({ value: "world" });
      expect(tokens[2]).toMatchObject({ value: "foo" });
      expect(tokens[3]).toEqual({ value: { item: 1 }, ovpIndex: 0, delayMultiplier: 1.0 });
    });

    it("preserves strings as single items when nestedTokenize is false (default)", () => {
      const tokenizer = new DefaultTokenizer<MixedItem>({ nestedTokenize: false });
      const mixedInput: MixedItem[] = ["The quick brown fox.", 123, { src: "fox.jpg" }];

      const tokens = tokenizer.tokenize(mixedInput);
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ value: "The quick brown fox.", delayMultiplier: 2.0 });
      expect(tokens[1]).toEqual({ value: 123, ovpIndex: 0, delayMultiplier: 1.0 });
      expect(tokens[2]).toEqual({ value: { src: "fox.jpg" }, ovpIndex: 0, delayMultiplier: 1.0 });
    });
  });

  it("returns empty array for null or undefined input", () => {
    const tokenizer = new DefaultTokenizer<unknown>();
    expect(tokenizer.tokenize(null)).toEqual([]);
    expect(tokenizer.tokenize(undefined)).toEqual([]);
  });
});
