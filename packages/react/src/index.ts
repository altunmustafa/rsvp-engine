/**
 * \@rsvp-engine/react
 * Headless React-compatible external store for \@rsvp-engine/core.
 */

export { createRsvpController } from "./controller";
export { createRsvpContext } from "./context";
export type {
  RsvpActions,
  RsvpContextBundle,
  RsvpController,
  RsvpControllerOptions,
  RsvpControllerSnapshot,
  RsvpEqualityFn,
  RsvpProviderProps,
  RsvpSelector,
  RsvpStoreListener,
  UseRsvpSelector,
} from "./types";

export {
  DEFAULT_WPM,
  EngineDestroyedError,
  EngineError,
  IndexOutOfBoundsError,
  InvalidInputError,
  InvalidTransitionError,
  ItemSelectionError,
  ListenerError,
  MAX_MS_PER_ITEM,
  MAX_WPM,
  MIN_MS_PER_ITEM,
  MIN_WPM,
  PlaybackSchedulingError,
  SessionLoadError,
  TokenizationError,
} from "@rsvp-engine/core";

export type {
  EngineErrorOptions,
  ErrorOptionsWithMessage,
  OvpStrategy,
  RsvpEventType,
  RsvpItem,
  RsvpEngineOptions,
  RsvpSnapshot,
  RsvpTiming,
  RsvpState,
  SchedulerStrategy,
  TimeDriver,
  Token,
  TokenizerStrategy,
  UnsubscribeFn,
} from "@rsvp-engine/core";
