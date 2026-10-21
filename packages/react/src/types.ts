import type {
  OvpStrategy,
  RsvpEngineOptions,
  RsvpSnapshot,
  RsvpStoreListener,
  Token,
  UnsubscribeFn,
} from "@rsvp-engine/core";
import type { ReactElement, ReactNode } from "react";

export type { RsvpStoreListener } from "@rsvp-engine/core";

/** Immutable observable state exposed by an RSVP controller. */
export type RsvpControllerSnapshot<T = string, TMeta = unknown> = RsvpSnapshot<T, TMeta>;

/** Commands that mutate an RSVP controller. */
export interface RsvpActions<T = string, TMeta = unknown> {
  readonly play: () => void;
  readonly pause: () => void;
  readonly stop: () => void;
  readonly seek: (index: number) => void;
  readonly next: () => void;
  readonly previous: () => void;
  readonly reset: () => void;
  /** Loads raw input using the configured tokenizer; throws nonfatal MissingTokenizerError without one. */
  readonly load: (data: T | T[]) => void;
  readonly loadTokens: (tokens: Token<T, TMeta>[]) => void;
  readonly setWpm: (wpm: number) => void;
  readonly setMsPerItem: (ms: number) => void;
  /** Sets or removes the presentation OVP override; preserves loadTokens offsets. */
  readonly setOvpStrategy: (strategy: OvpStrategy | undefined) => void;
}

/** Headless external store that owns one Core engine. */
export interface RsvpController<T = string, TMeta = unknown> extends RsvpActions<T, TMeta> {
  /** Reads the cached live snapshot. Do not read after destroy. */
  readonly getSnapshot: () => RsvpControllerSnapshot<T, TMeta>;
  /** Reads the immutable construction-time snapshot with empty content for SSR. Do not read after destroy. */
  readonly getServerSnapshot: () => RsvpControllerSnapshot<T, TMeta>;
  /** Subscribes to meaningful observable changes. */
  readonly subscribe: (listener: RsvpStoreListener<T, TMeta>) => UnsubscribeFn;
  /** Permanently clears playback buffers and subscriptions. Safe to repeat. */
  readonly destroy: () => void;
}

/** Props accepted by a typed RSVP context provider. */
export interface RsvpProviderProps<T = string, TMeta = unknown> {
  /** Externally owned controller shared with descendants. */
  readonly controller: RsvpController<T, TMeta>;
  readonly children?: ReactNode;
}

/** Selects a derived value from a controller snapshot. */
export type RsvpSelector<T, Selected, TMeta = unknown> = (
  state: RsvpControllerSnapshot<T, TMeta>,
) => Selected;

/** Determines whether two selected values are observably equal. */
export type RsvpEqualityFn<Selected> = (left: Selected, right: Selected) => boolean;

/** Context-bound selector hook with inferred result types. */
export type UseRsvpSelector<T, TMeta = unknown> = <Selected>(
  selector: RsvpSelector<T, Selected, TMeta>,
  equalityFn?: RsvpEqualityFn<Selected>,
) => Selected;

/** A typed Provider and its context-bound hooks. */
export interface RsvpContextBundle<T = string, TMeta = unknown> {
  readonly RsvpProvider: (props: RsvpProviderProps<T, TMeta>) => ReactElement;
  readonly useRsvpSelector: UseRsvpSelector<T, TMeta>;
  readonly useRsvpActions: () => RsvpActions<T, TMeta>;
  readonly useRsvpController: () => RsvpController<T, TMeta>;
}

/** Options accepted by {@link createRsvpController}. */
export type RsvpControllerOptions<T = string, TMeta = unknown> = RsvpEngineOptions<T, TMeta>;
