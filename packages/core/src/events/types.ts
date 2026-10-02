import type { RsvpItem } from "../engine/types";
import type { RsvpState } from "../state/types";

/** Function that removes an event listener when called. */
export type UnsubscribeFn = () => void;

export type RsvpEventType = "stateChange" | "itemChange" | "complete" | "error";

export interface StateChangePayload {
  readonly previous: RsvpState;
  readonly current: RsvpState;
}

export type ItemChangeReason = "playback" | "seek" | "next" | "previous";

export interface ItemChangePayload<T = string> {
  readonly item: RsvpItem<T>;
  readonly index: number;
  readonly progress: number;
  readonly reason: ItemChangeReason;
}

export interface CompletePayload<T = string> {
  readonly item: RsvpItem<T>;
  readonly totalItems: number;
}

export interface ErrorPayload {
  readonly error: Error;
}

export interface RsvpEventMap<T = string> {
  stateChange: StateChangePayload;
  itemChange: ItemChangePayload<T>;
  complete: CompletePayload<T>;
  error: ErrorPayload;
}

export type EventCallback<P = unknown> = (payload: P) => void;
