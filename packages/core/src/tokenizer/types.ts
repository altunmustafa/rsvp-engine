interface TokenFields<T, TMeta> {
  readonly value: T;
  readonly ovpIndex: number;
  /** Positive finite factor applied to msPerItem to determine display duration. */
  readonly durationMultiplier: number;
  /** Application-owned data retained by reference, without cloning or deep freezing. */
  readonly meta?: TMeta;
}

/**
 * Source content with an initial viewing offset, before any presentation override.
 * Metadata is required unless TMeta accepts undefined; its contents remain application-owned.
 */
export type Token<T, TMeta = unknown> = TokenFields<T, TMeta> &
  Readonly<Record<undefined extends TMeta ? never : "meta", TMeta>>;

/**
 * Strategy interface for pluggable text and item tokenization.
 */
export interface TokenizerStrategy<T, TMeta = unknown> {
  /**
   * Tokenizes raw input into an array of presentable tokens.
   */
  tokenize(input: T | T[]): Token<T, TMeta>[];
}

/**
 * Strategy for selecting the Optimal Viewing Position within text.
 */
export interface OvpStrategy {
  /**
   * Returns the zero-based UTF-16 offset of the preferred viewing position.
   * Implementations must be synchronous and side-effect-free.
   */
  calculate(text: string): number;
}
