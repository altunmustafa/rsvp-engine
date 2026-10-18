import type { RsvpEventType } from "./engine/types";

/** Options for engine errors, including their original cause and fatal classification. */
export interface EngineErrorOptions extends ErrorOptions {
  readonly isFatal?: boolean;
}

/** Optional message override and original cause for a concrete error. */
export interface ErrorOptionsWithMessage extends ErrorOptions {
  readonly message?: string;
}

/** Reports a subscriber failure independently of engine playback errors. */
export class ListenerError extends Error {
  public readonly eventType: RsvpEventType;
  declare readonly cause: unknown;

  constructor(eventType: RsvpEventType, options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? `Listener failed while handling '${eventType}'.`, options);
    this.name = "ListenerError";
    this.eventType = eventType;
  }
}

/** Common base class for command and playback errors. */
export class EngineError extends Error {
  public readonly isFatal: boolean;
  declare readonly cause: unknown;

  constructor(message = "Engine operation failed.", options: EngineErrorOptions = {}) {
    super(message, options);
    this.name = "EngineError";
    this.isFatal =
      (options.cause instanceof EngineError && options.cause.isFatal) || !!options.isFatal;
  }
}

/** Thrown when tokenization fails and the session must be cleared. */
export class TokenizationError extends EngineError {
  constructor(options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? "Failed to tokenize input.", { ...options, isFatal: true });
    this.name = "TokenizationError";
  }
}

/** Thrown when loading fails after session replacement has begun. */
export class SessionLoadError extends EngineError {
  constructor(options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? "Failed to load tokens.", { ...options, isFatal: true });
    this.name = "SessionLoadError";
  }
}

/** Thrown when item selection fails and playback cannot safely continue. */
export class ItemSelectionError extends EngineError {
  public readonly index: number;

  constructor(index: number, options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? `Failed to prepare item at index ${index}.`, {
      ...options,
      isFatal: true,
    });
    this.name = "ItemSelectionError";
    this.index = index;
  }
}

/** Thrown when playback scheduling fails and playback must stop. */
export class PlaybackSchedulingError extends EngineError {
  constructor(options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? "Failed to schedule playback.", { ...options, isFatal: true });
    this.name = "PlaybackSchedulingError";
  }
}

/**
 * Thrown when an invalid state transition is attempted.
 */
export class InvalidTransitionError extends EngineError {
  public readonly from: string;
  public readonly action: string;

  constructor(from: string, action: string, options: ErrorOptionsWithMessage = {}) {
    super(
      options.message ?? `Invalid transition: cannot perform '${action}' from '${from}' state.`,
      { ...options, isFatal: false },
    );
    this.name = "InvalidTransitionError";
    this.from = from;
    this.action = action;
  }
}

/**
 * Thrown when a command or new subscription targets a destroyed engine instance.
 */
export class EngineDestroyedError extends EngineError {
  constructor(options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? "Cannot interact with a destroyed engine instance.", {
      ...options,
      isFatal: false,
    });
    this.name = "EngineDestroyedError";
  }
}

/**
 * Thrown when invalid input is provided to the engine (empty text, null data, etc.).
 */
export class InvalidInputError extends EngineError {
  constructor(options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? "Invalid input.", { ...options, isFatal: false });
    this.name = "InvalidInputError";
  }
}

/**
 * Thrown when a seek index is out of bounds.
 */
export class IndexOutOfBoundsError extends EngineError {
  public readonly index: number;
  public readonly totalItems: number;

  constructor(index: number, totalItems: number, options: ErrorOptionsWithMessage = {}) {
    super(options.message ?? `Index ${index} is out of bounds (0..${totalItems - 1}).`, {
      ...options,
      isFatal: false,
    });
    this.name = "IndexOutOfBoundsError";
    this.index = index;
    this.totalItems = totalItems;
  }
}
