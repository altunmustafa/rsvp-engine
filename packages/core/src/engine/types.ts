import type { RsvpState } from "../state/types";
import type { Token } from "../tokenizer/types";

/**
 * The presentation view of a source token, with the effective viewing offset.
 * Sequence position belongs to RsvpSnapshot.currentIndex, not the item.
 * @typeParam T - The type of the item value (defaults to `string`).
 */
export type RsvpItem<T = string> = Token<T>;

/**
 * A readonly snapshot of the full engine state at a point in time.
 */
export interface RsvpSnapshot<T = string> {
  readonly state: RsvpState;
  readonly currentIndex: number;
  readonly currentItem: RsvpItem<T> | null;
  /** Position divided by item count; zero when empty, retained on fatal playback/navigation errors. */
  readonly progress: number;
  readonly totalItems: number;
  /** Exact WPM input, or the WPM derived from the last ms-per-item input. */
  readonly wpm: number;
  /** Exact ms-per-item input, or the interval derived from the last WPM input. */
  readonly msPerItem: number;
  /** Cached duration estimates sampled on playback and effective speed changes. */
  readonly timing: RsvpTiming;
}

/** Immutable duration estimates in milliseconds, sampled using the engine's TimeDriver. */
export interface RsvpTiming {
  /** Full playback estimate at the selected speed, excluding pauses and future host lag. */
  readonly totalDurationMs: number;
  /** Current-item remainder plus future periods; null in the fatal ERROR state. */
  readonly remainingDurationMs: number | null;
  /** Timestamp in the engine's clock; ERROR retains the last successful sample. */
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
  | "ovpChanged"
  | "reset"
  | "stateChanged";

/** Receives the immutable snapshot and the event that produced it. */
export type RsvpStoreListener<T = string> = (
  snapshot: RsvpSnapshot<T>,
  eventType: RsvpEventType,
) => void;

/** Removes a store subscription. Safe to call more than once. */
export type UnsubscribeFn = () => void;
