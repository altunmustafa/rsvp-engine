import type { RsvpEngineOptions } from "./config";
import type { RsvpItem, RsvpSnapshot } from "./types";
import type { EventCallback, RsvpEventMap, RsvpEventType, UnsubscribeFn } from "../events/types";
import type { SchedulerStrategy, TimeDriver } from "../scheduler/types";
import type { RsvpState } from "../state/types";
import type { Token, TokenizerStrategy } from "../tokenizer/types";

import { EngineDestroyedError, IndexOutOfBoundsError, InvalidInputError } from "../errors";
import { EventEmitter } from "../events/event-emitter";
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

/**
 * Headless RSVP Engine — orchestrates state machine, scheduler, tokenizer, and event emitter.
 * @typeParam T - The type of items being presented (defaults to `string`).
 */
export class RsvpEngine<T = string> {
  readonly #stateMachine: StateMachine;
  readonly #emitter: EventEmitter<T>;
  readonly #scheduler: SchedulerStrategy;
  readonly #timeDriver: TimeDriver;
  readonly #tokenizer: TokenizerStrategy<T>;
  #tokens: RsvpItem<T>[] = [];
  #currentIndex = 0;
  #hasPresentedCurrent = false;
  #deadline: number | null = null;
  #remainingDelay: number | null = null;
  #speed: SpeedSetting = { unit: "wpm", value: DEFAULT_WPM };
  #destroyed = false;

  constructor(options: RsvpEngineOptions<T> = {}) {
    this.#stateMachine = new StateMachine();
    this.#emitter = new EventEmitter<T>();

    this.#timeDriver = options.timeDriver ?? new SystemTimeDriver();
    this.#scheduler = options.scheduler ?? new DriftCorrectedScheduler(this.#timeDriver);
    this.#tokenizer = options.tokenizer ?? new DefaultTokenizer<T>();

    // msPerItem takes precedence over wpm
    if (options.msPerItem !== undefined) {
      this.setMsPerItem(options.msPerItem);
    } else if (options.wpm !== undefined) {
      this.setWpm(options.wpm);
    }

    // Constructor failures must remain observable because listeners cannot be attached yet.
    if (options.data !== undefined) {
      this.load(options.data);
    }
  }

  // ────────── Tokenization & Loading ──────────

  /**
   * Tokenizes and loads raw data into the engine using the configured tokenizer.
   */
  public load(data: T | T[]): void {
    this.#assertNotDestroyed();
    this.#assertCanLoad();
    try {
      this.loadTokens(this.#tokenizer.tokenize(data));
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error;
      }
      this.#enterFatalError(this.#toError(error));
      throw error;
    }
  }

  /**
   * Directly loads pre-tokenized items into the engine.
   * Useful when tokenization is performed externally (e.g. AI or asynchronous tokenizers).
   */
  public loadTokens(tokens: Token<T>[]): void {
    this.#assertNotDestroyed();
    this.#assertCanLoad();
    validateTokens(tokens);
    const previousState = this.#stateMachine.state;
    this.#stateMachine.transition("load");
    this.#scheduler.cancel();
    this.#setTokens(tokens);
    this.#currentIndex = 0;
    this.#hasPresentedCurrent = false;
    this.#deadline = null;
    this.#remainingDelay = null;
    if (previousState !== "IDLE") {
      this.#emitter.emit("stateChange", { previous: previousState, current: "IDLE" });
    }
  }

  #assertCanLoad(): void {
    if (this.#stateMachine.state === "PLAYING" || this.#stateMachine.state === "ERROR") {
      throw new InvalidInputError(`Cannot load data while engine is ${this.#stateMachine.state}.`);
    }
  }

  #setTokens(tokens: Token<T>[]): void {
    this.#tokens = tokens.map((token, index) => ({
      value: token.value,
      index,
      ovpIndex: token.ovpIndex,
      delayMultiplier: token.delayMultiplier,
    }));
  }

  // ────────── Error handling ──────────

  #enterFatalError(error: Error): void {
    const previousState = this.#stateMachine.state;
    try {
      this.#stateMachine.transition("error");
    } catch {
      this.#reportError(error);
      return;
    }
    this.#scheduler.cancel();
    this.#deadline = null;
    this.#remainingDelay = null;
    this.#reportError(error);
    this.#emitter.emit("stateChange", { previous: previousState, current: "ERROR" });
  }

  #reportError(error: Error): void {
    this.#emitter.emit("error", { error });
  }

  #toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  // ────────── Destroyed guard ──────────

  #assertNotDestroyed(): void {
    if (this.#destroyed) {
      throw new EngineDestroyedError();
    }
  }

  // ────────── Tick loop ──────────

  readonly #advance = (): void => {
    this.#deadline = null;
    this.#remainingDelay = null;
    if (this.#stateMachine.state !== "PLAYING") {
      return;
    }

    if (this.#currentIndex >= this.#tokens.length - 1) {
      this.#completePlayback();
      return;
    }

    this.#currentIndex++;
    this.#presentCurrent();
  };

  #presentCurrent(): void {
    const item = this.#tokens[this.#currentIndex];
    this.#hasPresentedCurrent = true;

    this.#emitter.emit("itemChange", {
      item,
      index: this.#currentIndex,
      progress: this.progress,
      reason: "playback",
    });
    if (this.#stateMachine.state !== "PLAYING") {
      return;
    }

    this.#scheduleAdvance(this.msPerItem * item.delayMultiplier);
  }

  #scheduleAdvance(delay: number): void {
    this.#remainingDelay = null;
    this.#deadline = this.#timeDriver.now() + delay;
    try {
      this.#scheduler.schedule(this.#advance, delay);
    } catch (error) {
      this.#enterFatalError(this.#toError(error));
    }
  }

  #completePlayback(): void {
    this.#scheduler.cancel();
    const previousState = this.#stateMachine.state;
    this.#stateMachine.transition("complete");
    const item = this.#tokens[this.#currentIndex];
    this.#emitter.emit("stateChange", { previous: previousState, current: "COMPLETED" });
    this.#emitter.emit("complete", { item, totalItems: this.#tokens.length });
  }

  // ────────── Playback Control ──────────

  /**
   * Starts or resumes playback.
   * From STOPPED/COMPLETED: resets index to 0 and starts from beginning.
   * From PAUSED: resumes from current position.
   */
  public play(): void {
    this.#assertNotDestroyed();
    this.#startPlayback();
  }

  #startPlayback(): void {
    // Validate we have tokens
    if (this.#tokens.length === 0) {
      this.#reportError(new InvalidInputError("Cannot play: no tokens loaded."));
      return;
    }

    const previousState = this.#stateMachine.state;

    // Reset index if coming from STOPPED or COMPLETED
    if (previousState === "STOPPED" || previousState === "COMPLETED") {
      this.#currentIndex = 0;
    }

    try {
      this.#stateMachine.transition("play");
    } catch (err) {
      this.#reportError(this.#toError(err));
      return;
    }

    this.#emitter.emit("stateChange", {
      previous: previousState,
      current: "PLAYING",
    });

    if (previousState === "PAUSED" && this.#hasPresentedCurrent) {
      const item = this.#tokens[this.#currentIndex];
      this.#scheduleAdvance(this.#remainingDelay ?? this.msPerItem * item.delayMultiplier);
      return;
    }

    this.#hasPresentedCurrent = false;
    this.#presentCurrent();
  }

  /**
   * Pauses playback, preserving the current index.
   */
  public pause(): void {
    this.#assertNotDestroyed();

    const previousState = this.#stateMachine.state;

    try {
      this.#stateMachine.transition("pause");
    } catch (err) {
      this.#reportError(this.#toError(err));
      return;
    }

    this.#remainingDelay =
      this.#deadline === null ? null : Math.max(0, this.#deadline - this.#timeDriver.now());
    this.#scheduler.cancel();
    this.#deadline = null;

    this.#emitter.emit("stateChange", {
      previous: previousState,
      current: "PAUSED",
    });
  }

  /**
   * Stops playback and resets the index to 0.
   */
  public stop(): void {
    this.#assertNotDestroyed();

    const previousState = this.#stateMachine.state;

    try {
      this.#stateMachine.transition("stop");
    } catch (err) {
      this.#reportError(this.#toError(err));
      return;
    }

    this.#scheduler.cancel();
    this.#currentIndex = 0;
    this.#hasPresentedCurrent = false;
    this.#deadline = null;
    this.#remainingDelay = null;

    this.#emitter.emit("stateChange", {
      previous: previousState,
      current: "STOPPED",
    });
  }

  /**
   * Jumps to a specific token index. Transitions to PAUSED state.
   * Only available from PAUSED, STOPPED, or COMPLETED states.
   * The index must be a finite integer within the loaded token bounds.
   */
  public seek(index: number): void {
    this.#assertNotDestroyed();

    if (!Number.isInteger(index) || index < 0 || index >= this.#tokens.length) {
      this.#reportError(new IndexOutOfBoundsError(index, this.#tokens.length));
      return;
    }

    const previousState = this.#stateMachine.state;

    try {
      this.#stateMachine.transition("seek");
    } catch (err) {
      this.#reportError(this.#toError(err));
      return;
    }

    this.#currentIndex = index;
    this.#hasPresentedCurrent = true;
    this.#remainingDelay = this.msPerItem * this.#tokens[index].delayMultiplier;

    if (previousState !== "PAUSED") {
      this.#emitter.emit("stateChange", {
        previous: previousState,
        current: "PAUSED",
      });
    }

    this.#emitter.emit("itemChange", {
      item: this.#tokens[index],
      index,
      progress: this.progress,
      reason: "seek",
    });
  }

  /**
   * Advances to the next token. Only available from PAUSED state.
   */
  public next(): void {
    this.#assertNotDestroyed();

    if (this.#stateMachine.state !== "PAUSED") {
      this.#emitter.emit("error", {
        error: new InvalidInputError("next() is only available in PAUSED state."),
      });
      return;
    }

    if (this.#currentIndex < this.#tokens.length - 1) {
      this.#currentIndex++;
      this.#hasPresentedCurrent = true;
      this.#remainingDelay = this.msPerItem * this.#tokens[this.#currentIndex].delayMultiplier;
      this.#emitter.emit("itemChange", {
        item: this.#tokens[this.#currentIndex],
        index: this.#currentIndex,
        progress: this.progress,
        reason: "next",
      });
    }
  }

  /**
   * Retreats to the previous token. Only available from PAUSED state.
   */
  public previous(): void {
    this.#assertNotDestroyed();

    if (this.#stateMachine.state !== "PAUSED") {
      this.#emitter.emit("error", {
        error: new InvalidInputError("previous() is only available in PAUSED state."),
      });
      return;
    }

    if (this.#currentIndex > 0) {
      this.#currentIndex--;
      this.#hasPresentedCurrent = true;
      this.#remainingDelay = this.msPerItem * this.#tokens[this.#currentIndex].delayMultiplier;
      this.#emitter.emit("itemChange", {
        item: this.#tokens[this.#currentIndex],
        index: this.#currentIndex,
        progress: this.progress,
        reason: "previous",
      });
    }
  }

  /**
   * Resets engine to IDLE state, clearing all data.
   * Only valid from ERROR state.
   */
  public reset(): void {
    this.#assertNotDestroyed();

    const previousState = this.#stateMachine.state;

    try {
      this.#stateMachine.transition("reset");
    } catch (err) {
      this.#reportError(this.#toError(err));
      return;
    }

    this.#scheduler.cancel();
    this.#tokens = [];
    this.#currentIndex = 0;
    this.#hasPresentedCurrent = false;
    this.#deadline = null;
    this.#remainingDelay = null;

    this.#emitter.emit("stateChange", {
      previous: previousState,
      current: "IDLE",
    });
  }

  /**
   * Clears all timers, removes listeners, and disposes the engine.
   * Required for SPA component unmount cleanup.
   */
  public destroy(): void {
    if (this.#destroyed) {
      return; // idempotent
    }
    this.#scheduler.cancel();
    this.#deadline = null;
    this.#remainingDelay = null;
    this.#emitter.removeAllListeners();
    this.#destroyed = true;
  }

  // ────────── Speed Control ──────────

  /**
   * Sets WPM for subsequently scheduled display periods, preserving the input exactly.
   * The corresponding ms-per-item interval is derived without additional rounding.
   */
  public setWpm(wpm: number): void {
    this.#assertNotDestroyed();
    validateWpm(wpm);
    this.#speed = { unit: "wpm", value: wpm };
  }

  /**
   * Sets the interval for subsequently scheduled display periods, preserving the input exactly.
   * The corresponding WPM is derived without additional rounding.
   */
  public setMsPerItem(ms: number): void {
    this.#assertNotDestroyed();
    validateMsPerItem(ms);
    this.#speed = { unit: "msPerItem", value: ms };
  }

  // ────────── State & Snapshot Getters ──────────

  /** Current engine state. */
  public get state(): RsvpState {
    return this.#stateMachine.state;
  }

  /** Exact WPM input, or the WPM derived from the last ms-per-item input. */
  public get wpm(): number {
    return this.#speed.unit === "wpm" ? this.#speed.value : 60_000 / this.#speed.value;
  }

  /** Exact ms-per-item input, or the interval derived from the last WPM input. */
  public get msPerItem(): number {
    return this.#speed.unit === "msPerItem" ? this.#speed.value : 60_000 / this.#speed.value;
  }

  /** Current token index (0-based). */
  public get currentIndex(): number {
    return this.#currentIndex;
  }

  /** Current token/item being displayed, or null if none. */
  public get currentItem(): RsvpItem<T> | null {
    return this.#tokens[this.#currentIndex] ?? null;
  }

  /** Playback progress (0–1). */
  public get progress(): number {
    if (this.#tokens.length === 0) {
      return 0;
    }
    return this.#hasPresentedCurrent ? (this.#currentIndex + 1) / this.#tokens.length : 0;
  }

  /** Total number of tokens/items. */
  public get totalItems(): number {
    return this.#tokens.length;
  }

  // ────────── Event System ──────────

  /**
   * Subscribes to an engine event. Returns an unsubscribe function.
   */
  public on<K extends RsvpEventType>(
    event: K,
    callback: EventCallback<RsvpEventMap<T>[K]>,
  ): UnsubscribeFn {
    this.#assertNotDestroyed();
    return this.#emitter.on(event, callback);
  }

  // ────────── Snapshot ──────────

  /**
   * Returns a frozen, readonly snapshot of the full engine state.
   */
  public snapshot(): RsvpSnapshot<T> {
    this.#assertNotDestroyed();
    return Object.freeze({
      state: this.state,
      currentIndex: this.#currentIndex,
      currentItem: this.currentItem,
      progress: this.progress,
      totalItems: this.totalItems,
      wpm: this.wpm,
      msPerItem: this.msPerItem,
    });
  }
}
