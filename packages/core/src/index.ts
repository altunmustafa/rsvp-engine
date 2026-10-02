/**
 * \@rsvp-engine/core
 * Headless, zero-dependency RSVP (Rapid Serial Visual Presentation) engine.
 */

// Core Engine
export { DEFAULT_WPM, MIN_WPM, MAX_WPM, MIN_MS_PER_ITEM, MAX_MS_PER_ITEM } from "./engine/config";
export type { RsvpEngineOptions } from "./engine/config";
export { RsvpEngine } from "./engine/rsvp-engine";

// Shared Types
export type { RsvpItem, RsvpSnapshot } from "./engine/types";
export type { RsvpState } from "./state/types";
export type { UnsubscribeFn } from "./events/types";

// Events
export type {
  RsvpEventType,
  RsvpEventMap,
  StateChangePayload,
  ItemChangePayload,
  ItemChangeReason,
  ErrorPayload,
  EventCallback,
  CompletePayload,
} from "./events/types";
export { EventEmitter } from "./events/event-emitter";

// State Machine
export { StateMachine } from "./state/state-machine";
export type { StateMachineAction } from "./state/types";

// Tokenizer & OVP
export type { OvpStrategy, Token, TokenizerStrategy } from "./tokenizer/types";
export { DefaultOvpStrategy } from "./tokenizer/ovp";
export { DefaultTokenizer } from "./tokenizer/default-tokenizer";
export type { DefaultTokenizerOptions } from "./tokenizer/default-tokenizer";

// Scheduler & Time Driver
export type { SchedulerStrategy, TimeDriver } from "./scheduler/types";
export { SystemTimeDriver } from "./scheduler/system-time-driver";
export { DriftCorrectedScheduler } from "./scheduler/drift-corrected-scheduler";

// Errors
export {
  InvalidTransitionError,
  EngineDestroyedError,
  InvalidInputError,
  IndexOutOfBoundsError,
} from "./errors";
