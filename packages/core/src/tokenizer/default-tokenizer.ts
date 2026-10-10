import type { OvpStrategy, Token, TokenizerStrategy } from "./types";

import { InvalidInputError } from "../errors";

import { DefaultOvpStrategy } from "./ovp";

/**
 * Options for configuring `DefaultTokenizer`.
 */
export interface DefaultTokenizerOptions {
  /** Multiplier for sentence-ending punctuation (`.`, `!`, `?`). Defaults to `2.0`. */
  readonly sentenceDurationMultiplier?: number;
  /** Multiplier for clause-ending punctuation (`,`, `;`, `:`). Defaults to `1.5`. */
  readonly clauseDurationMultiplier?: number;
  /** Multiplier for dashes (`—`, `–`). Defaults to `1.3`. */
  readonly dashDurationMultiplier?: number;
  /** Whether array elements and nested inputs should be recursively tokenized. Defaults to `false`. */
  readonly nestedTokenize?: boolean;
  /** Strategy used to calculate viewing positions for string tokens. */
  readonly ovpStrategy?: OvpStrategy;
}

/**
 * Default configurable tokenizer for text, items, and array inputs.
 * Splits text on whitespace and assigns duration multipliers based on punctuation.
 * Wraps custom generic items or arrays into presentable tokens.
 * @typeParam T - The type of items being presented (defaults to `string`).
 */
export class DefaultTokenizer<T> implements TokenizerStrategy<T> {
  readonly #sentenceDurationMultiplier: number;
  readonly #clauseDurationMultiplier: number;
  readonly #dashDurationMultiplier: number;
  readonly #nestedTokenize: boolean;
  readonly #ovpStrategy: OvpStrategy;

  constructor(options: DefaultTokenizerOptions = {}) {
    this.#sentenceDurationMultiplier = options.sentenceDurationMultiplier ?? 2.0;
    this.#clauseDurationMultiplier = options.clauseDurationMultiplier ?? 1.5;
    this.#dashDurationMultiplier = options.dashDurationMultiplier ?? 1.3;
    this.#nestedTokenize = options.nestedTokenize ?? false;
    this.#ovpStrategy = options.ovpStrategy ?? new DefaultOvpStrategy();
    this.#validateOptions();
  }

  public tokenize(input: T | T[]): Token<T>[] {
    if (input === null || input === undefined) {
      return [];
    }

    if (Array.isArray(input)) {
      return this.#tokenizeArray(input);
    }

    if (typeof input === "string") {
      return this.#tokenizeText(input) as Token<T>[];
    }

    return [
      {
        value: input,
        ovpIndex: 0,
        durationMultiplier: this.#calculateDurationMultiplier(input),
      },
    ];
  }

  #tokenizeArray(items: T[]): Token<T>[] {
    if (this.#nestedTokenize) {
      return items.flatMap((item) => this.tokenize(item));
    }

    return items.map((item) => ({
      value: item,
      ovpIndex: typeof item === "string" ? this.#ovpStrategy.calculate(item) : 0,
      durationMultiplier: this.#calculateDurationMultiplier(item),
    }));
  }

  #tokenizeText(text: string): Token<string>[] {
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

  #calculateDurationMultiplier(item: unknown): number {
    if (typeof item === "string") {
      if (/[.!?。！？…]+[\p{Pe}\p{Pf}"']*$/u.test(item)) {
        return this.#sentenceDurationMultiplier;
      }
      if (/[,;:，、；：]+[\p{Pe}\p{Pf}"']*$/u.test(item)) {
        return this.#clauseDurationMultiplier;
      }
      if (/\p{Pd}+[\p{Pe}\p{Pf}"']*$/u.test(item)) {
        return this.#dashDurationMultiplier;
      }
      return 1.0;
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
        throw new InvalidInputError(`${name} must be a positive finite number.`);
      }
    }
  }

  #segmentWords(text: string): string[] {
    const Segmenter = globalThis.Intl?.Segmenter;
    if (typeof Segmenter !== "function") {
      return text.split(/\s+/);
    }

    const segmenter = new Segmenter(undefined, { granularity: "word" });
    const tokens: string[] = [];
    let prefix = "";
    let atBoundary = true;
    for (const part of segmenter.segment(text)) {
      if (/^\s+$/u.test(part.segment)) {
        if (prefix) {
          tokens.push(prefix);
        }
        prefix = "";
        atBoundary = true;
      } else if (part.isWordLike || !isPunctuation(part.segment)) {
        tokens.push(prefix + part.segment);
        prefix = "";
        atBoundary = false;
      } else if (atBoundary || prefix || /^[\p{Ps}\p{Pi}]+$/u.test(part.segment)) {
        prefix += part.segment;
      } else {
        tokens[tokens.length - 1] += part.segment;
      }
    }
    if (prefix) {
      tokens.push(prefix);
    }
    return tokens;
  }
}

function isPunctuation(value: string): boolean {
  return /^\p{P}+$/u.test(value);
}
