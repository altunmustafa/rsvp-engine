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
  readonly durationMultiplier: number;
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
  /** Cached duration estimates sampled on playback and effective speed changes. */
  readonly timing: RsvpTiming;
}

/** Immutable duration estimates in milliseconds, sampled using the engine's TimeDriver. */
export interface RsvpTiming {
  /** Full playback estimate at the selected speed, excluding pauses and future host lag. */
  readonly totalDurationMs: number;
  /** Current-item remainder plus future periods; null in the fatal ERROR state. */
  readonly remainingDurationMs: number | null;
  /** Timestamp in the engine's clock, not necessarily a Unix timestamp. */
  readonly sampledAtMs: number;
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
