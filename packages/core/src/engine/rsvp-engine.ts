import type { RsvpEngineOptions } from "./config";
import type {
  RsvpEventType,
  RsvpItem,
  RsvpSnapshot,
  RsvpStoreListener,
  UnsubscribeFn,
} from "./types";
import type { SchedulerStrategy, TimeDriver } from "../scheduler/types";
import type { RsvpState } from "../state/types";
import type { Token, TokenizerStrategy } from "../tokenizer/types";

import { EngineDestroyedError, IndexOutOfBoundsError, InvalidInputError } from "../errors";
import { DriftCorrectedScheduler } from "../scheduler/drift-corrected-scheduler";
import { SystemTimeDriver } from "../scheduler/system-time-driver";
import { StateMachine } from "../state/state-machine";
import { DefaultTokenizer } from "../tokenizer/default-tokenizer";

import { DEFAULT_WPM } from "./config";
import { validateMsPerItem, validateTokens, validateWpm } from "./validation";

interface SpeedSetting {
  readonly unit: "wpm" | "msPerItem";
  readonly value: number;
}

interface StoreNotification<T> {
  readonly snapshot: RsvpSnapshot<T>;
  readonly eventType: RsvpEventType;
}

/**
 * Headless playback engine with a synchronous observable store.
 * @typeParam T - The type of items being presented (defaults to string).
 */
export class RsvpEngine<T = string> {
  readonly #stateMachine = new StateMachine();
  readonly #listeners = new Set<RsvpStoreListener<T>>();
  readonly #scheduler: SchedulerStrategy;
  readonly #timeDriver: TimeDriver;
  readonly #tokenizer: TokenizerStrategy<T>;
  #tokens: RsvpItem<T>[] = [];
  #currentIndex = 0;
  #hasPresentedCurrent = false;
  #deadline: number | null = null;
  #remainingDelay: number | null = null;
  #scheduleRevision = 0;
  #speed: SpeedSetting = { unit: "wpm", value: DEFAULT_WPM };
  #error: Error | null = null;
  #snapshot: RsvpSnapshot<T>;
  #destroyed = false;
  #notifying = false;
  readonly #pendingNotifications: StoreNotification<T>[] = [];

  constructor(options: RsvpEngineOptions<T> = {}) {
    this.#timeDriver = options.timeDriver ?? new SystemTimeDriver();
    this.#scheduler = options.scheduler ?? new DriftCorrectedScheduler(this.#timeDriver);
    this.#tokenizer = options.tokenizer ?? new DefaultTokenizer<T>();
    this.#snapshot = this.#createSnapshot();
    if (options.msPerItem !== undefined) {
      this.setMsPerItem(options.msPerItem);
    } else if (options.wpm !== undefined) {
      this.setWpm(options.wpm);
    }
    if (options.data !== undefined) {
      this.load(options.data);
    }
  }

  /** Tokenizes and loads data; successful loading clears the last error. */
  public load(data: T | T[]): void {
    this.#execute(() => {
      this.#assertCanLoad();
      let tokens: Token<T>[];
      try {
        tokens = this.#tokenizer.tokenize(data);
      } catch (error) {
        if (!(error instanceof InvalidInputError)) {
          this.#enterFatalError(this.#toError(error));
        }
        throw error;
      }
      this.#loadTokens(tokens);
      return "loaded";
    });
  }

  /** Loads pre-tokenized items; successful loading clears the last error. */
  public loadTokens(tokens: Token<T>[]): void {
    this.#execute(() => {
      this.#loadTokens(tokens);
      return "loaded";
    });
  }

  #loadTokens(tokens: Token<T>[]): void {
    this.#assertCanLoad();
    validateTokens(tokens);
    this.#stateMachine.transition("load");
    this.#cancelAdvance();
    this.#tokens = tokens.map((token, index) =>
      Object.freeze({
        value: token.value,
        index,
        ovpIndex: token.ovpIndex,
        delayMultiplier: token.delayMultiplier,
      }),
    );
    this.#currentIndex = 0;
    this.#hasPresentedCurrent = false;
    this.#deadline = null;
    this.#remainingDelay = null;
    this.#error = null;
  }

  #assertCanLoad(): void {
    if (this.state === "PLAYING" || this.state === "ERROR") {
      throw new InvalidInputError(`Cannot load data while engine is ${this.state}.`);
    }
  }

  #enterFatalError(error: Error): void {
    this.#stateMachine.transition("error");
    this.#cancelAdvance();
    this.#deadline = null;
    this.#remainingDelay = null;
    this.#error = error;
  }

  #toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  #assertNotDestroyed(): void {
    if (this.#destroyed) {
      throw new EngineDestroyedError();
    }
  }

  #execute(action: () => RsvpEventType): void {
    this.#assertNotDestroyed();
    let eventType: RsvpEventType;
    try {
      eventType = action();
    } catch (error) {
      this.#error = this.#toError(error);
      try {
        this.#publish("errorOccurred");
      } catch {
        // A subscriber failure must not replace the original command failure.
      }
      throw error;
    }
    this.#publish(eventType);
  }

  #transition(action: "play" | "pause" | "stop" | "seek" | "reset"): boolean {
    try {
      this.#stateMachine.transition(action);
      return true;
    } catch (error) {
      this.#error = this.#toError(error);
      return false;
    }
  }

  #advance(): void {
    if (this.#destroyed || this.state !== "PLAYING") {
      return;
    }
    this.#execute(() => {
      this.#deadline = null;
      this.#remainingDelay = null;
      if (this.#currentIndex === this.#tokens.length - 1) {
        this.#cancelAdvance();
        this.#stateMachine.transition("complete");
        return "completed";
      } else {
        this.#currentIndex++;
        return this.#presentCurrent() ? "advanced" : "errorOccurred";
      }
    });
  }

  #presentCurrent(): boolean {
    this.#hasPresentedCurrent = true;
    return this.#scheduleAdvance(this.msPerItem * this.#tokens[this.#currentIndex].delayMultiplier);
  }

  #scheduleAdvance(delay: number): boolean {
    const revision = ++this.#scheduleRevision;
    this.#remainingDelay = null;
    this.#deadline = this.#timeDriver.now() + delay;
    try {
      this.#scheduler.schedule(() => {
        if (revision === this.#scheduleRevision) {
          this.#advance();
        }
      }, delay);
      return true;
    } catch (error) {
      this.#enterFatalError(this.#toError(error));
      return false;
    }
  }

  #cancelAdvance(): void {
    this.#scheduleRevision++;
    this.#scheduler.cancel();
  }

  /** Starts playback, resumes the preserved remainder, or replays a stopped/completed session. */
  public play(): void {
    this.#execute(() => {
      if (this.#tokens.length === 0) {
        this.#error = new InvalidInputError("Cannot play: no tokens loaded.");
        return "errorOccurred";
      }
      const previousState = this.state;
      if (!this.#transition("play")) {
        return "errorOccurred";
      }
      if (previousState === "STOPPED" || previousState === "COMPLETED") {
        this.#currentIndex = 0;
      }
      if (previousState === "PAUSED" && this.#hasPresentedCurrent) {
        const item = this.#tokens[this.#currentIndex];
        return this.#scheduleAdvance(this.#remainingDelay ?? this.msPerItem * item.delayMultiplier)
          ? "resumed"
          : "errorOccurred";
      } else {
        return this.#presentCurrent() ? "started" : "errorOccurred";
      }
    });
  }

  /** Pauses playback and preserves the current item's remaining display time. */
  public pause(): void {
    this.#execute(() => {
      if (!this.#transition("pause")) {
        return "errorOccurred";
      }
      this.#remainingDelay =
        this.#deadline === null ? null : Math.max(0, this.#deadline - this.#timeDriver.now());
      this.#cancelAdvance();
      this.#deadline = null;
      return "paused";
    });
  }

  /** Stops PLAYING/PAUSED playback and resets the position, retaining loaded items. */
  public stop(): void {
    this.#execute(() => {
      if (!this.#transition("stop")) {
        return "errorOccurred";
      }
      this.#cancelAdvance();
      this.#currentIndex = 0;
      this.#hasPresentedCurrent = false;
      this.#deadline = null;
      this.#remainingDelay = null;
      return "stopped";
    });
  }

  /** Selects a finite integer index in PAUSED, STOPPED, or COMPLETED and enters PAUSED. */
  public seek(index: number): void {
    this.#execute(() => {
      if (!Number.isInteger(index) || index < 0 || index >= this.#tokens.length) {
        this.#error = new IndexOutOfBoundsError(index, this.#tokens.length);
        return "errorOccurred";
      }
      if (!this.#transition("seek")) {
        return "errorOccurred";
      }
      this.#selectItem(index);
      return "navigated";
    });
  }

  #selectItem(index: number): void {
    this.#currentIndex = index;
    this.#hasPresentedCurrent = true;
    this.#remainingDelay = this.msPerItem * this.#tokens[index].delayMultiplier;
  }

  /** Advances one item while PAUSED; does nothing at the final item. */
  public next(): void {
    this.#navigate(1, "next");
  }

  /** Retreats one item while PAUSED; does nothing at the first item. */
  public previous(): void {
    this.#navigate(-1, "previous");
  }

  #navigate(offset: number, command: string): void {
    this.#execute(() => {
      if (this.state !== "PAUSED") {
        this.#error = new InvalidInputError(`${command}() is only available in PAUSED state.`);
        return "errorOccurred";
      }
      const index = this.#currentIndex + offset;
      if (index >= 0 && index < this.#tokens.length) {
        this.#selectItem(index);
      }
      return "navigated";
    });
  }

  /** Recovers from ERROR to IDLE, clearing data and the last error. */
  public reset(): void {
    this.#execute(() => {
      if (!this.#transition("reset")) {
        return "errorOccurred";
      }
      this.#cancelAdvance();
      this.#tokens = [];
      this.#currentIndex = 0;
      this.#hasPresentedCurrent = false;
      this.#deadline = null;
      this.#remainingDelay = null;
      this.#error = null;
      return "reset";
    });
  }

  /** Clears the last error without changing playback or recovering from ERROR. */
  public clearError(): void {
    this.#execute(() => {
      this.#error = null;
      return "errorCleared";
    });
  }

  /** Cancels playback and subscriptions. The last cached snapshot remains readable. */
  public destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#cancelAdvance();
    this.#deadline = null;
    this.#remainingDelay = null;
    this.#listeners.clear();
    this.#destroyed = true;
  }

  /** Sets exact WPM for subsequent display periods; the active period is preserved. */
  public setWpm(wpm: number): void {
    this.#execute(() => {
      validateWpm(wpm);
      this.#speed = { unit: "wpm", value: wpm };
      return "speedChanged";
    });
  }

  /** Sets exact milliseconds per item for subsequent display periods. */
  public setMsPerItem(ms: number): void {
    this.#execute(() => {
      validateMsPerItem(ms);
      this.#speed = { unit: "msPerItem", value: ms };
      return "speedChanged";
    });
  }

  /** Current playback state. */
  public get state(): RsvpState {
    return this.#stateMachine.state;
  }
  /** Exact WPM input or the value derived from milliseconds per item. */
  public get wpm(): number {
    return this.#speed.unit === "wpm" ? this.#speed.value : 60_000 / this.#speed.value;
  }
  /** Exact interval input or the value derived from WPM. */
  public get msPerItem(): number {
    return this.#speed.unit === "msPerItem" ? this.#speed.value : 60_000 / this.#speed.value;
  }
  /** Selected item's zero-based index. */
  public get currentIndex(): number {
    return this.#currentIndex;
  }
  /** Selected item, or null for empty data. */
  public get currentItem(): RsvpItem<T> | null {
    return this.#tokens[this.#currentIndex] ?? null;
  }
  /** Fraction of items presented; completion follows the final display period. */
  public get progress(): number {
    if (this.#tokens.length === 0) {
      return 0;
    }
    return this.#hasPresentedCurrent ? (this.#currentIndex + 1) / this.#tokens.length : 0;
  }
  /** Number of loaded items. */
  public get totalItems(): number {
    return this.#tokens.length;
  }

  /** Reads cached immutable playback and error state, including after destroy. */
  readonly getSnapshot = (): RsvpSnapshot<T> => this.#snapshot;

  /** Subscribes to synchronous changes; subscribing does not invoke the callback. */
  readonly subscribe = (listener: RsvpStoreListener<T>): UnsubscribeFn => {
    this.#assertNotDestroyed();
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #createSnapshot(): RsvpSnapshot<T> {
    return Object.freeze({
      state: this.state,
      currentIndex: this.#currentIndex,
      currentItem: this.currentItem,
      progress: this.progress,
      totalItems: this.totalItems,
      wpm: this.wpm,
      msPerItem: this.msPerItem,
      error: this.#error,
    });
  }

  #publish(eventType: RsvpEventType): void {
    const previous = this.#snapshot;
    const changed =
      previous.state !== this.state ||
      previous.currentIndex !== this.#currentIndex ||
      previous.currentItem !== this.currentItem ||
      previous.progress !== this.progress ||
      previous.totalItems !== this.totalItems ||
      previous.wpm !== this.wpm ||
      previous.msPerItem !== this.msPerItem ||
      previous.error !== this.#error;
    if (!changed) {
      return;
    }
    this.#snapshot = this.#createSnapshot();
    if (this.#notifying) {
      this.#pendingNotifications.push({ snapshot: this.#snapshot, eventType });
      return;
    }
    this.#notifying = true;
    try {
      this.#notify(this.#snapshot, eventType);
      for (let index = 0; index < this.#pendingNotifications.length && !this.#destroyed; index++) {
        const notification = this.#pendingNotifications[index];
        this.#notify(notification.snapshot, notification.eventType);
      }
    } finally {
      this.#pendingNotifications.length = 0;
      this.#notifying = false;
    }
  }

  #notify(snapshot: RsvpSnapshot<T>, eventType: RsvpEventType): void {
    for (const listener of Array.from(this.#listeners)) {
      if (this.#destroyed) {
        break;
      }
      listener(snapshot, eventType);
    }
  }
}
