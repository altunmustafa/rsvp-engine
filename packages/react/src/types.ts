import type { RSVPEngineOptions, RSVPSnapshot, Token, UnsubscribeFn } from "@rsvp-engine/core";
import type { ReactElement, ReactNode } from "react";

/** Callback invoked after the controller's observable snapshot changes. */
export type RsvpStoreListener = () => void;

/** Immutable observable state exposed by an RSVP controller. */
export interface RsvpControllerSnapshot<T = string> {
  /** The latest immutable Core snapshot. */
  readonly snapshot: RSVPSnapshot<T>;
  /** The most recently observed error, or `null` after explicit clearing. */
  readonly error: Error | null;
}

/** Commands that mutate an RSVP controller. */
export interface RsvpActions<T = string> {
  readonly play: () => void;
  readonly pause: () => void;
  readonly stop: () => void;
  readonly seek: (index: number) => void;
  readonly next: () => void;
  readonly previous: () => void;
  readonly reset: () => void;
  readonly load: (data: T | T[]) => void;
  readonly loadTokens: (tokens: Token<T>[]) => void;
  readonly setSpeed: (wpm: number) => void;
  readonly setMsPerItem: (ms: number) => void;
  readonly clearError: () => void;
}

/** Headless external store that owns one Core engine. */
export interface RsvpController<T = string> extends RsvpActions<T> {
  /** Reads the cached live snapshot. */
  readonly getSnapshot: () => RsvpControllerSnapshot<T>;
  /** Reads the immutable construction-time snapshot used for server rendering. */
  readonly getServerSnapshot: () => RsvpControllerSnapshot<T>;
  /** Subscribes to meaningful observable changes. */
  readonly subscribe: (listener: RsvpStoreListener) => UnsubscribeFn;
  /** Permanently releases the owned engine and all subscriptions. */
  readonly destroy: () => void;
}

/** Props accepted by a typed RSVP context provider. */
export interface RsvpProviderProps<T = string> {
  /** Externally owned controller shared with descendants. */
  readonly controller: RsvpController<T>;
  readonly children?: ReactNode;
}

/** Selects a derived value from a controller snapshot. */
export type RsvpSelector<T, Selected> = (state: RsvpControllerSnapshot<T>) => Selected;

/** Determines whether two selected values are observably equal. */
export type RsvpEqualityFn<Selected> = (left: Selected, right: Selected) => boolean;

/** Context-bound selector hook with inferred result types. */
export type UseRsvpSelector<T> = <Selected>(
  selector: RsvpSelector<T, Selected>,
  equalityFn?: RsvpEqualityFn<Selected>,
) => Selected;

/** A typed Provider and its context-bound hooks. */
export interface RsvpContextBundle<T = string> {
  readonly RsvpProvider: (props: RsvpProviderProps<T>) => ReactElement;
  readonly useRsvpSelector: UseRsvpSelector<T>;
  readonly useRsvpActions: () => RsvpActions<T>;
  readonly useRsvpController: () => RsvpController<T>;
}

/** Options accepted by {@link createRsvpController}. */
export type RsvpControllerOptions<T = string> = RSVPEngineOptions<T>;
