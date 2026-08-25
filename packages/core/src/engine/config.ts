import type { SchedulerStrategy, TimeDriver } from "../scheduler/types";
import type { TokenizerStrategy } from "../tokenizer/types";

/**
 * Configuration options for the RSVP Engine.
 */
export interface RSVPEngineOptions<T = string> {
  /** Raw text string, single generic item, or generic item array. */
  readonly data?: T | T[];
  /** Target speed in Words Per Minute. Defaults to 300. */
  readonly wpm?: number;
  /** Direct ms-per-item override. Takes precedence over `wpm`. */
  readonly msPerItem?: number;
  /** Custom tokenizer strategy. Defaults to `DefaultTokenizer`. */
  readonly tokenizer?: TokenizerStrategy<T>;
  /** Custom scheduler strategy. Defaults to `DriftCorrectedScheduler`. */
  readonly scheduler?: SchedulerStrategy;
  /** Clock used to preserve remaining display time across pause/resume. */
  readonly timeDriver?: TimeDriver;
}

/** Minimum allowed playback speed in Words Per Minute. */
export const MIN_WPM = 1;
/** Maximum allowed playback speed in Words Per Minute. */
export const MAX_WPM = 6_000;
/** Minimum allowed display interval per item in milliseconds. */
export const MIN_MS_PER_ITEM = 60_000 / MAX_WPM;
/** Maximum allowed display interval per item in milliseconds. */
export const MAX_MS_PER_ITEM = 60_000 / MIN_WPM;
/** Default playback speed in Words Per Minute. */
export const DEFAULT_WPM = 300;
