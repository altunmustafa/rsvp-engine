import type { RsvpState } from "../state/types";

/**
 * A single presentable item in the RSVP sequence.
 * @typeParam T - The type of the item value (defaults to `string`).
 */
export interface RsvpItem<T = string> {
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
export interface RsvpSnapshot<T = string> {
  readonly state: RsvpState;
  readonly currentIndex: number;
  readonly currentItem: RsvpItem<T> | null;
  readonly progress: number;
  readonly totalItems: number;
  /** Exact WPM input, or the WPM derived from the last ms-per-item input. */
  readonly wpm: number;
  /** Exact ms-per-item input, or the interval derived from the last WPM input. */
  readonly msPerItem: number;
  /** Last engine error; cleared explicitly or by successful loading/reset. */
  readonly error: Error | null;
}

/** The single event that produced an observable engine update. */
export type RsvpEventType =
  | "loaded"
  | "started"
  | "resumed"
  | "paused"
  | "stopped"
  | "advanced"
  | "navigated"
  | "completed"
  | "speedChanged"
  | "reset"
  | "errorOccurred"
  | "errorCleared";

/** Receives the immutable snapshot and the event that produced it. */
export type RsvpStoreListener<T = string> = (
  snapshot: RsvpSnapshot<T>,
  eventType: RsvpEventType,
) => void;

/** Removes a store subscription. Safe to call more than once. */
export type UnsubscribeFn = () => void;
