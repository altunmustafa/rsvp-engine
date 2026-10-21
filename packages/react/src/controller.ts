import type { RsvpController, RsvpControllerSnapshot } from "./types";
import type {
  OvpStrategy,
  RsvpEngineOptions,
  RsvpStoreListener,
  Token,
  UnsubscribeFn,
} from "@rsvp-engine/core";

import { RsvpEngine } from "@rsvp-engine/core";

class RsvpControllerImpl<T, TMeta> implements RsvpController<T, TMeta> {
  readonly #engine: RsvpEngine<T, TMeta>;
  readonly #serverSnapshot: RsvpControllerSnapshot<T, TMeta>;

  constructor(options: RsvpEngineOptions<T, TMeta>) {
    this.#engine = new RsvpEngine<T, TMeta>(options);
    this.#serverSnapshot = this.#engine.getSnapshot();
  }

  readonly getSnapshot = (): RsvpControllerSnapshot<T, TMeta> => this.#engine.getSnapshot();
  readonly getServerSnapshot = (): RsvpControllerSnapshot<T, TMeta> => this.#serverSnapshot;
  readonly subscribe = (listener: RsvpStoreListener<T, TMeta>): UnsubscribeFn =>
    this.#engine.subscribe(listener);
  readonly play = (): void => this.#engine.play();
  readonly pause = (): void => this.#engine.pause();
  readonly stop = (): void => this.#engine.stop();
  readonly seek = (index: number): void => this.#engine.seek(index);
  readonly next = (): void => this.#engine.next();
  readonly previous = (): void => this.#engine.previous();
  readonly reset = (): void => this.#engine.reset();
  readonly load = (data: T | T[]): void => this.#engine.load(data);
  readonly loadTokens = (tokens: Token<T, TMeta>[]): void => this.#engine.loadTokens(tokens);
  readonly setWpm = (wpm: number): void => this.#engine.setWpm(wpm);
  readonly setMsPerItem = (ms: number): void => this.#engine.setMsPerItem(ms);
  readonly setOvpStrategy = (strategy: OvpStrategy | undefined): void =>
    this.#engine.setOvpStrategy(strategy);
  readonly destroy = (): void => this.#engine.destroy();
}

/** Creates an empty headless controller that owns one Core engine. Load content separately. */
export function createRsvpController<T = string, TMeta = unknown>(
  options: RsvpEngineOptions<T, TMeta> = {},
): RsvpController<T, TMeta> {
  return new RsvpControllerImpl<T, TMeta>(options);
}
