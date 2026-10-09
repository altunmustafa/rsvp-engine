import type { RsvpController, RsvpControllerSnapshot, RsvpStoreListener } from "./types";
import type { RsvpEngineOptions, Token, UnsubscribeFn } from "@rsvp-engine/core";

import { RsvpEngine } from "@rsvp-engine/core";

class RsvpControllerImpl<T> implements RsvpController<T> {
  readonly #engine: RsvpEngine<T>;
  readonly #serverSnapshot: RsvpControllerSnapshot<T>;

  constructor(options: RsvpEngineOptions<T>) {
    this.#engine = new RsvpEngine(options);
    this.#serverSnapshot = this.#engine.getSnapshot();
  }

  readonly getSnapshot = (): RsvpControllerSnapshot<T> => this.#engine.getSnapshot();
  readonly getServerSnapshot = (): RsvpControllerSnapshot<T> => this.#serverSnapshot;
  readonly subscribe = (listener: RsvpStoreListener<T>): UnsubscribeFn =>
    this.#engine.subscribe(listener);
  readonly play = (): void => this.#engine.play();
  readonly pause = (): void => this.#engine.pause();
  readonly stop = (): void => this.#engine.stop();
  readonly seek = (index: number): void => this.#engine.seek(index);
  readonly next = (): void => this.#engine.next();
  readonly previous = (): void => this.#engine.previous();
  readonly reset = (): void => this.#engine.reset();
  readonly load = (data: T | T[]): void => this.#engine.load(data);
  readonly loadTokens = (tokens: Token<T>[]): void => this.#engine.loadTokens(tokens);
  readonly setWpm = (wpm: number): void => this.#engine.setWpm(wpm);
  readonly setMsPerItem = (ms: number): void => this.#engine.setMsPerItem(ms);
  readonly clearError = (): void => this.#engine.clearError();
  readonly destroy = (): void => this.#engine.destroy();
}

/** Creates a headless controller that owns one Core engine. */
export function createRsvpController<T = string>(
  options: RsvpEngineOptions<T> = {},
): RsvpController<T> {
  return new RsvpControllerImpl(options);
}
