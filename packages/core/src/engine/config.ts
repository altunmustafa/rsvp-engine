import type { EngineError, ListenerError } from "../errors";
import type { SchedulerStrategy, TimeDriver } from "../scheduler/types";
import type { OvpStrategy, TokenizerStrategy } from "../tokenizer/types";

/** Engine configuration, independent of session content. */
export interface RsvpEngineOptions<T = string, TMeta = unknown> {
  /** Target WPM, preserved exactly unless msPerItem is supplied. Defaults to 300. */
  readonly wpm?: number;
  /** Direct ms-per-item override. Takes precedence over `wpm`. */
  readonly msPerItem?: number;
  /** Converts raw input for `load()`. Optional when only using `loadTokens()`. */
  readonly tokenizer?: TokenizerStrategy<T, TMeta>;
  /**
   * Overrides string viewing offsets when selected in sessions loaded through `load()`,
   * independently of the tokenizer's initial OVP calculation. Stored token offsets and
   * `loadTokens()` sessions are unchanged. Update or remove with `setOvpStrategy()`.
   */
  readonly ovpStrategy?: OvpStrategy;
  /** Custom scheduler strategy. Defaults to `DriftCorrectedScheduler`. */
  readonly scheduler?: SchedulerStrategy;
  /** Clock used to preserve remaining display time across pause/resume. */
  readonly timeDriver?: TimeDriver;
  /** Reports timer and listener failures; synchronous command failures are thrown to their caller. */
  readonly onError?: (error: EngineError | ListenerError) => void;
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
