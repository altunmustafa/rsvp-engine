import type { RSVPState } from "../state/types";

/**
 * A single presentable item in the RSVP sequence.
 * @typeParam T - The type of the item value (defaults to `string`).
 */
export interface RSVPItem<T = string> {
  /** The raw value of the item. */
  readonly value: T;
  /** Zero-based index within the token sequence. */
  readonly index: number;
  /** Optimal Viewing Position character index within the value. */
  readonly ovpIndex: number;
  /** Multiplier applied to msPerItem for this token (e.g. 2.0 for sentence-ending punctuation). */
  readonly delayMultiplier: number;
}

/**
 * A readonly snapshot of the full engine state at a point in time.
 */
export interface RSVPSnapshot<T = string> {
  readonly state: RSVPState;
  readonly currentIndex: number;
  readonly currentItem: RSVPItem<T> | null;
  readonly progress: number;
  readonly totalItems: number;
  /** Exact WPM input, or the WPM derived from the last ms-per-item input. */
  readonly wpm: number;
  /** Exact ms-per-item input, or the interval derived from the last WPM input. */
  readonly msPerItem: number;
}
