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
  IndexOutOfBoundsError,
  InvalidInputError,
  InvalidTransitionError,
  MAX_MS_PER_ITEM,
  MAX_WPM,
  MIN_MS_PER_ITEM,
  MIN_WPM,
} from "@rsvp-engine/core";

export type {
  OVPStrategy,
  RSVPItem,
  RSVPEngineOptions,
  RSVPSnapshot,
  RSVPState,
  SchedulerStrategy,
  TimeDriver,
  Token,
  TokenizerStrategy,
  UnsubscribeFn,
} from "@rsvp-engine/core";
