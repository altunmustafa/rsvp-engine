import type { Token } from "../tokenizer/types";

import { InvalidInputError } from "../errors";

import { MAX_MS_PER_ITEM, MAX_WPM, MIN_MS_PER_ITEM, MIN_WPM } from "./config";

export function validateTokens<T>(tokens: Token<T>[]): void {
  if (!Array.isArray(tokens)) {
    throw new InvalidInputError("tokens must be an array.");
  }

  for (const [index, token] of tokens.entries()) {
    if (typeof token !== "object" || token === null) {
      throw new InvalidInputError(`Token ${index} must be an object.`);
    }
    if (!Number.isInteger(token.ovpIndex) || token.ovpIndex < 0) {
      throw new InvalidInputError(`Token ${index} has an invalid ovpIndex.`);
    }
    if (typeof token.value === "string" && token.ovpIndex > token.value.length) {
      throw new InvalidInputError(`Token ${index} has an out-of-range ovpIndex.`);
    }
    if (!Number.isFinite(token.delayMultiplier) || token.delayMultiplier <= 0) {
      throw new InvalidInputError(`Token ${index} has an invalid delayMultiplier.`);
    }
  }
}

export function validateWpm(wpm: number): void {
  if (!Number.isFinite(wpm) || wpm < MIN_WPM || wpm > MAX_WPM) {
    throw new InvalidInputError(`wpm must be a finite number between ${MIN_WPM} and ${MAX_WPM}.`);
  }
}

export function validateMsPerItem(ms: number): void {
  if (!Number.isFinite(ms) || ms < MIN_MS_PER_ITEM || ms > MAX_MS_PER_ITEM) {
    throw new InvalidInputError(
      `msPerItem must be a finite number between ${MIN_MS_PER_ITEM} and ${MAX_MS_PER_ITEM}.`,
    );
  }
}
