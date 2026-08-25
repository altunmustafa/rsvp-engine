import type { RSVPItem } from "../engine/types";
import type { RSVPState } from "../state/types";

/** Function that removes an event listener when called. */
export type UnsubscribeFn = () => void;

export type RSVPEventType = "stateChange" | "itemChange" | "complete" | "error";

export interface StateChangePayload {
  readonly previous: RSVPState;
  readonly current: RSVPState;
}

export type ItemChangeReason = "playback" | "seek" | "next" | "previous";

export interface ItemChangePayload<T = string> {
  readonly item: RSVPItem<T>;
  readonly index: number;
  readonly progress: number;
  readonly reason: ItemChangeReason;
}

export interface CompletePayload<T = string> {
  readonly item: RSVPItem<T>;
  readonly totalItems: number;
}

export interface ErrorPayload {
  readonly error: Error;
}

export interface RSVPEventMap<T = string> {
  stateChange: StateChangePayload;
  itemChange: ItemChangePayload<T>;
  complete: CompletePayload<T>;
  error: ErrorPayload;
}

export type EventCallback<P = unknown> = (payload: P) => void;
