import type { RsvpController, RsvpControllerSnapshot, RsvpStoreListener } from "./types";
import type {
  ErrorPayload,
  RSVPEngineOptions,
  RSVPSnapshot,
  Token,
  UnsubscribeFn,
} from "@rsvp-engine/core";

import { EngineDestroyedError, RSVPEngine } from "@rsvp-engine/core";

function coreSnapshotsEqual<T>(left: RSVPSnapshot<T>, right: RSVPSnapshot<T>): boolean {
  return (
    left.state === right.state &&
    left.currentIndex === right.currentIndex &&
    left.currentItem === right.currentItem &&
    left.progress === right.progress &&
    left.totalItems === right.totalItems &&
    left.wpm === right.wpm &&
    left.msPerItem === right.msPerItem
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

class RsvpControllerImpl<T> implements RsvpController<T> {
  readonly #engine: RSVPEngine<T>;
  readonly #listeners = new Set<RsvpStoreListener>();
  readonly #engineUnsubscribers: UnsubscribeFn[];
  readonly #serverSnapshot: RsvpControllerSnapshot<T>;
  #snapshot: RsvpControllerSnapshot<T>;
  #errorRevision = 0;
  #destroyed = false;

  constructor(options: RSVPEngineOptions<T>) {
    this.#engine = new RSVPEngine(options);
    this.#snapshot = Object.freeze({
      snapshot: this.#engine.snapshot(),
      error: null,
    });
    this.#serverSnapshot = this.#snapshot;
    this.#engineUnsubscribers = [
      this.#engine.on("stateChange", this.#handleEngineChange),
      this.#engine.on("itemChange", this.#handleEngineChange),
      this.#engine.on("complete", this.#handleEngineChange),
      this.#engine.on("error", this.#handleEngineError),
    ];
  }

  readonly getSnapshot = (): RsvpControllerSnapshot<T> => this.#snapshot;

  readonly getServerSnapshot = (): RsvpControllerSnapshot<T> => this.#serverSnapshot;

  readonly subscribe = (listener: RsvpStoreListener): UnsubscribeFn => {
    this.#assertActive();
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly play = (): void => this.#execute(() => this.#engine.play());

  readonly pause = (): void => this.#execute(() => this.#engine.pause());

  readonly stop = (): void => this.#execute(() => this.#engine.stop());

  readonly seek = (index: number): void => this.#execute(() => this.#engine.seek(index));

  readonly next = (): void => this.#execute(() => this.#engine.next());

  readonly previous = (): void => this.#execute(() => this.#engine.previous());

  readonly reset = (): void => this.#execute(() => this.#engine.reset());

  readonly load = (data: T | T[]): void => this.#execute(() => this.#engine.load(data));

  readonly loadTokens = (tokens: Token<T>[]): void =>
    this.#execute(() => this.#engine.loadTokens(tokens));

  readonly setSpeed = (wpm: number): void => this.#execute(() => this.#engine.setSpeed(wpm));

  readonly setMsPerItem = (ms: number): void => this.#execute(() => this.#engine.setMsPerItem(ms));

  readonly clearError = (): void => {
    this.#assertActive();
    if (this.#snapshot.error === null) {
      return;
    }
    this.#errorRevision++;
    this.#commit(this.#engine.snapshot(), null);
  };

  readonly destroy = (): void => {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    for (const unsubscribe of this.#engineUnsubscribers) {
      unsubscribe();
    }
    this.#engine.destroy();
    this.#listeners.clear();
  };

  readonly #handleEngineChange = (): void => {
    this.#commit(this.#engine.snapshot(), this.#snapshot.error);
  };

  readonly #handleEngineError = ({ error }: ErrorPayload): void => {
    this.#recordError(error);
  };

  #execute(action: () => void): void {
    this.#assertActive();
    const errorRevision = this.#errorRevision;

    try {
      action();
      this.#commit(this.#engine.snapshot(), this.#snapshot.error);
    } catch (error) {
      if (this.#errorRevision === errorRevision) {
        this.#recordError(toError(error));
      }
      throw error;
    }
  }

  #recordError(error: Error): void {
    this.#errorRevision++;
    this.#commit(this.#engine.snapshot(), error);
  }

  #commit(snapshot: RSVPSnapshot<T>, error: Error | null): void {
    if (coreSnapshotsEqual(this.#snapshot.snapshot, snapshot) && this.#snapshot.error === error) {
      return;
    }

    this.#snapshot = Object.freeze({ snapshot, error });
    for (const listener of Array.from(this.#listeners)) {
      listener();
    }
  }

  #assertActive(): void {
    if (this.#destroyed) {
      throw new EngineDestroyedError();
    }
  }
}

/** Creates a headless controller that owns one Core engine. */
export function createRsvpController<T = string>(
  options: RSVPEngineOptions<T> = {},
): RsvpController<T> {
  return new RsvpControllerImpl(options);
}
