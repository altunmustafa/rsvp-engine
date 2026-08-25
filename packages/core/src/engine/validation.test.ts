import type { Token } from "../tokenizer/types";

import { describe, expect, it } from "vitest";

import { InvalidInputError } from "../errors";

import { MAX_MS_PER_ITEM, MAX_WPM, MIN_MS_PER_ITEM, MIN_WPM } from "./config";
import { validateMsPerItem, validateTokens, validateWpm } from "./validation";

describe("validateTokens", () => {
  it("accepts valid tokens", () => {
    expect(() =>
      validateTokens([{ value: "word", ovpIndex: 1, delayMultiplier: 1 }]),
    ).not.toThrow();
  });

  it("rejects a non-array value", () => {
    expect(() => validateTokens(null as unknown as Token<string>[])).toThrowError(
      new InvalidInputError("tokens must be an array."),
    );
  });

  it("rejects non-object tokens", () => {
    expect(() => validateTokens([null as unknown as Token<string>])).toThrow(
      "Token 0 must be an object.",
    );
  });

  it.each([-1, 1.5])("rejects invalid ovpIndex %s", (ovpIndex) => {
    expect(() => validateTokens([{ value: "word", ovpIndex, delayMultiplier: 1 }])).toThrow(
      "Token 0 has an invalid ovpIndex.",
    );
  });

  it("rejects a string ovpIndex beyond the string length", () => {
    expect(() => validateTokens([{ value: "word", ovpIndex: 5, delayMultiplier: 1 }])).toThrow(
      "Token 0 has an out-of-range ovpIndex.",
    );
  });

  it.each([0, Number.NaN])("rejects invalid delayMultiplier %s", (delayMultiplier) => {
    expect(() => validateTokens([{ value: "word", ovpIndex: 1, delayMultiplier }])).toThrow(
      "Token 0 has an invalid delayMultiplier.",
    );
  });
});

describe("validateWpm", () => {
  it.each([MIN_WPM, MAX_WPM])("accepts boundary value %s", (wpm) => {
    expect(() => validateWpm(wpm)).not.toThrow();
  });

  it.each([MIN_WPM - 1, MAX_WPM + 1, Number.NaN])("rejects invalid value %s", (wpm) => {
    expect(() => validateWpm(wpm)).toThrow(InvalidInputError);
  });
});

describe("validateMsPerItem", () => {
  it.each([MIN_MS_PER_ITEM, MAX_MS_PER_ITEM])("accepts boundary value %s", (ms) => {
    expect(() => validateMsPerItem(ms)).not.toThrow();
  });

  it.each([MIN_MS_PER_ITEM - 1, MAX_MS_PER_ITEM + 1, Number.NaN])(
    "rejects invalid value %s",
    (ms) => {
      expect(() => validateMsPerItem(ms)).toThrow(InvalidInputError);
    },
  );
});
