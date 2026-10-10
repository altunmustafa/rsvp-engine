/**
 * A processed token ready for presentation.
 */
export interface Token<T> {
  readonly value: T;
  readonly ovpIndex: number;
  /** Positive finite factor applied to msPerItem to determine display duration. */
  readonly durationMultiplier: number;
}

/**
 * Strategy interface for pluggable text and item tokenization.
 */
export interface TokenizerStrategy<T> {
  /**
   * Tokenizes raw input into an array of presentable tokens.
   */
  tokenize(input: T | T[]): Token<T>[];
}

/**
 * Strategy for selecting the Optimal Viewing Position within text.
 */
export interface OvpStrategy {
  /**
   * Returns the zero-based UTF-16 offset of the preferred viewing position.
   */
  calculate(text: string): number;
}
