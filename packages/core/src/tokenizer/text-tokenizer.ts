import type { OvpStrategy, Token, TokenizerStrategy } from "./types";

import { InvalidInputError } from "../errors";

import { DefaultOvpStrategy } from "./default-ovp-strategy";

/**
 * Options for configuring `TextTokenizer`.
 */
export interface TextTokenizerOptions {
  /** Multiplier for sentence-ending punctuation (`.`, `!`, `?`). Defaults to `2.0`. */
  readonly sentenceDurationMultiplier?: number;
  /** Multiplier for clause-ending punctuation (`,`, `;`, `:`). Defaults to `1.5`. */
  readonly clauseDurationMultiplier?: number;
  /** Multiplier for dashes (`—`, `–`). Defaults to `1.3`. */
  readonly dashDurationMultiplier?: number;
  /** Strategy used to calculate viewing positions for string tokens. */
  readonly ovpStrategy?: OvpStrategy;
}

/**
 * Converts text or a flat array of texts into words with viewing offsets and punctuation timing.
 * Each text is segmented independently; empty texts produce no tokens.
 */
export class TextTokenizer implements TokenizerStrategy<string> {
  readonly #sentenceDurationMultiplier: number;
  readonly #clauseDurationMultiplier: number;
  readonly #dashDurationMultiplier: number;
  readonly #ovpStrategy: OvpStrategy;

  constructor(options: TextTokenizerOptions = {}) {
    this.#sentenceDurationMultiplier = options.sentenceDurationMultiplier ?? 2.0;
    this.#clauseDurationMultiplier = options.clauseDurationMultiplier ?? 1.5;
    this.#dashDurationMultiplier = options.dashDurationMultiplier ?? 1.3;
    this.#ovpStrategy = options.ovpStrategy ?? new DefaultOvpStrategy();
    this.#validateOptions();
  }

  /**
   * Segments each text independently and concatenates its words in input order.
   * @throws InvalidInputError - When input is not text or a flat, dense array of texts.
   */
  public tokenize(input: string | string[]): Omit<Token<string>, "meta">[] {
    const texts = typeof input === "string" ? [input] : input;
    if (!Array.isArray(texts)) {
      throw new InvalidInputError({
        message: "TextTokenizer expects a string or a flat array of strings.",
      });
    }
    for (const text of texts) {
      if (typeof text !== "string") {
        throw new InvalidInputError({
          message: "TextTokenizer expects a string or a flat array of strings.",
        });
      }
    }
    return texts.flatMap((text) => this.#tokenizeText(text));
  }

  #tokenizeText(text: string): Omit<Token<string>, "meta">[] {
    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    const words = this.#segmentWords(trimmed);
    return words.map((word) => ({
      value: word,
      ovpIndex: this.#ovpStrategy.calculate(word),
      durationMultiplier: this.#calculateDurationMultiplier(word),
    }));
  }

  #calculateDurationMultiplier(value: string): number {
    if (/[.!?。！？…]+[\p{Pe}\p{Pf}"']*$/u.test(value)) {
      return this.#sentenceDurationMultiplier;
    }
    if (/[,;:，、；：]+[\p{Pe}\p{Pf}"']*$/u.test(value)) {
      return this.#clauseDurationMultiplier;
    }
    if (/\p{Pd}+[\p{Pe}\p{Pf}"']*$/u.test(value)) {
      return this.#dashDurationMultiplier;
    }
    return 1.0;
  }

  #validateOptions(): void {
    const options = [
      ["sentenceDurationMultiplier", this.#sentenceDurationMultiplier],
      ["clauseDurationMultiplier", this.#clauseDurationMultiplier],
      ["dashDurationMultiplier", this.#dashDurationMultiplier],
    ] as const;
    for (const [name, value] of options) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new InvalidInputError({ message: `${name} must be a positive finite number.` });
      }
    }
  }

  #segmentWords(text: string): string[] {
    const Segmenter = globalThis.Intl?.Segmenter;
    if (typeof Segmenter !== "function") {
      return text.split(/\s+/);
    }

    const segmenter = new Segmenter(undefined, { granularity: "word" });
    const words: string[] = [];
    let prefix = "";
    let atBoundary = true;
    for (const part of segmenter.segment(text)) {
      if (/^\s+$/u.test(part.segment)) {
        if (prefix) {
          words.push(prefix);
        }
        prefix = "";
        atBoundary = true;
      } else if (part.isWordLike || !isPunctuation(part.segment)) {
        words.push(prefix + part.segment);
        prefix = "";
        atBoundary = false;
      } else if (atBoundary || prefix || /^[\p{Ps}\p{Pi}]+$/u.test(part.segment)) {
        prefix += part.segment;
      } else {
        words[words.length - 1] += part.segment;
      }
    }
    if (prefix) {
      words.push(prefix);
    }
    return words;
  }
}

function isPunctuation(value: string): boolean {
  return /^\p{P}+$/u.test(value);
}
