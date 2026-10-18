import type { RsvpEngineOptions } from "./config";
import type {
  RsvpEventType,
  RsvpItem,
  RsvpSnapshot,
  RsvpStoreListener,
  RsvpTiming,
  UnsubscribeFn,
} from "./types";
import type { RuntimeGlobal } from "../runtimeGlobal";
import type { SchedulerStrategy, TimeDriver } from "../scheduler/types";
import type { RsvpState } from "../state/types";
import type { OvpStrategy, Token, TokenizerStrategy } from "../tokenizer/types";

import {
  EngineDestroyedError,
  EngineError,
  IndexOutOfBoundsError,
  InvalidInputError,
  ItemSelectionError,
  ListenerError,
  PlaybackSchedulingError,
  SessionLoadError,
  TokenizationError,
} from "../errors";
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

interface PresentationState<T> {
  index: number;
  // Cache the presentation result without overwriting tokenizer offsets.
  item: RsvpItem<T> | null;
  // Used while PLAYING.
  deadlineAtMs: number;
  // Stored display duration before scheduling or while paused; PLAYING uses deadlineAtMs.
  remainingMs: number;
}

interface StoreNotification<T> {
  readonly snapshot: RsvpSnapshot<T>;
  readonly eventType: RsvpEventType;
}

// Diagnostic delivery failures must never enter the playback error policy.
class UndeliveredError extends AggregateError {
  constructor(errors: readonly unknown[], options?: ErrorOptions) {
    super(errors, "Failed to report error.", options);
    this.name = "UndeliveredError";
  }
}

/**
 * Headless playback engine with a synchronous observable store.
 * Reads after destroy are unsupported; commands and new subscriptions are rejected.
 * @typeParam T - The type of items being presented (defaults to string).
 */
export class RsvpEngine<T = string> {
  readonly #stateMachine = new StateMachine();
  readonly #scheduler: SchedulerStrategy;
  readonly #timeDriver: TimeDriver;
  readonly #tokenizer: TokenizerStrategy<T>;
  readonly #onError: RsvpEngineOptions<T>["onError"];
  #reportingError = false;
  // Overrides presentation when a string item is selected, independently of tokenizer OVP.
  // Retains the preference across sessions without changing stored token offsets.
  #ovpStrategy: OvpStrategy | undefined;
  #executingStrategy = false;

  #tokens: Token<T>[] = [];
  #isExternalTokens = false;
  #presentation: PresentationState<T> = {
    index: 0,
    item: null,
    deadlineAtMs: 0,
    remainingMs: 0,
  };
  // Each index stores the duration multiplier sum from that item through the final item.
  #suffixMultiplierSums = new Float64Array(1);

  #speed: SpeedSetting = { unit: "wpm", value: DEFAULT_WPM };
  #timing: RsvpTiming;
  // Seeking to the selected item can restart its duration without changing the item reference.
  #remainingTimeChanged = false;
  // Invalidates stale callbacks after cancellation or rescheduling, even if the scheduler still invokes them.
  #scheduleRevision = 0;

  #destroyed = false;
  #snapshot: RsvpSnapshot<T>;
  readonly #listeners = new Set<RsvpStoreListener<T>>();
  #notifying = false;
  readonly #notificationQueue: StoreNotification<T>[] = [];

  constructor(options: RsvpEngineOptions<T> = {}) {
    this.#onError = options.onError;
    this.#timeDriver = options.timeDriver ?? new SystemTimeDriver();
    this.#timing = Object.freeze({
      totalDurationMs: 0,
      remainingDurationMs: 0,
      sampledAtMs: this.#readTime(),
    });
    this.#scheduler = options.scheduler ?? new DriftCorrectedScheduler(this.#timeDriver);
    this.#tokenizer = options.tokenizer ?? new DefaultTokenizer<T>();
    this.#snapshot = this.#createSnapshot();
    if (options.ovpStrategy !== undefined) {
      this.setOvpStrategy(options.ovpStrategy);
    }
    if (options.msPerItem !== undefined) {
      this.setMsPerItem(options.msPerItem);
    } else if (options.wpm !== undefined) {
      this.setWpm(options.wpm);
    }
    if (options.data !== undefined) {
      this.load(options.data);
    }
  }

  /** Permanently clears playback buffers and subscriptions. Safe to repeat. */
  public destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#assertNotExecutingStrategy();
    try {
      this.#cancelAdvance();
    } finally {
      this.#listeners.clear();
      this.#notificationQueue.length = 0;
      this.#clearSessionData();
      this.#ovpStrategy = undefined;
      this.#destroyed = true;
    }
  }

  /** Tokenizes and loads data. */
  public load(data: T | T[]): void {
    this.#execute(() => {
      this.#assertCanLoad();
      let tokens: Token<T>[];
      try {
        tokens = this.#runStrategy(() => this.#tokenizer.tokenize(data));
      } catch (error) {
        this.#clearSessionData();
        throw new TokenizationError({ cause: error });
      }
      this.#loadTokens(tokens);
    });
  }

  /** Loads source tokens. */
  public loadTokens(tokens: Token<T>[]): void {
    this.#execute(() => this.#loadTokens(tokens, true));
  }

  /** Starts playback, resumes the preserved remainder, or replays a stopped/completed session. */
  public play(): void {
    this.#execute(() => {
      if (this.#tokens.length === 0) {
        throw new InvalidInputError({ message: "Cannot play: no tokens loaded." });
      }
      const previousState = this.state;
      this.#transition("play");
      if (previousState === "PAUSED") {
        if (this.#presentation.remainingMs === 0) {
          this.#advanceToNextItem();
          return;
        }
        this.#scheduleAdvance(this.#presentation.remainingMs);
        this.#publishNotification("resumed");
        return;
      }
      try {
        this.#selectItem(0);
      } catch (error) {
        throw new ItemSelectionError(0, { cause: error });
      }
      this.#scheduleAdvance(this.#presentation.remainingMs);
      this.#publishNotification("started");
    });
  }

  /** Pauses playback and preserves the current item's remaining display time. */
  public pause(): void {
    this.#execute(() => {
      this.#transition("pause");
      this.#presentation.remainingMs = Math.max(
        0,
        this.#presentation.deadlineAtMs - this.#readTime(),
      );
      this.#cancelAdvance();
      this.#presentation.deadlineAtMs = 0;
      this.#publishNotification("paused");
    });
  }

  /** Returns playback to the beginning, retaining items; no-op in IDLE/STOPPED, invalid in ERROR. */
  public stop(): void {
    this.#execute(() => {
      const previousState = this.state;
      this.#transition("stop");
      if (previousState === "IDLE" || previousState === "STOPPED") {
        return;
      }
      this.#cancelAdvance();
      try {
        this.#selectItem(0);
      } catch (error) {
        throw new ItemSelectionError(0, { cause: error });
      }
      this.#publishNotification("stopped");
    });
  }

  /** Selects a finite integer index in IDLE, PAUSED, STOPPED, or COMPLETED and enters PAUSED. */
  public seek(index: number): void {
    this.#execute(() => {
      if (!Number.isInteger(index) || index < 0 || index >= this.#tokens.length) {
        throw new IndexOutOfBoundsError(index, this.#tokens.length);
      }
      this.#navigateTo(index);
    });
  }

  /** Advances one item while PAUSED; does nothing at the final item. */
  public next(): void {
    this.#navigateBy(1, "next");
  }

  /** Retreats one item while PAUSED; does nothing at the first item. */
  public previous(): void {
    this.#navigateBy(-1, "previous");
  }

  /** Recovers from ERROR to IDLE and clears loaded data. */
  public reset(): void {
    this.#execute(() => {
      this.#transition("reset");
      this.#cancelAdvance();
      this.#clearSessionData();
      this.#publishNotification("reset");
    });
  }

  /** Sets exact WPM for subsequent display periods; the active period is preserved. */
  public setWpm(wpm: number): void {
    this.#execute(() => {
      validateWpm(wpm);
      this.#speed = { unit: "wpm", value: wpm };
      this.#publishNotification("speedChanged");
    });
  }

  /** Sets exact milliseconds per item for subsequent display periods. */
  public setMsPerItem(ms: number): void {
    this.#execute(() => {
      validateMsPerItem(ms);
      this.#speed = { unit: "msPerItem", value: ms };
      this.#publishNotification("speedChanged");
    });
  }

  /**
   * Sets or removes the presentation OVP strategy independently of the tokenizer's strategy.
   * For sessions loaded through `load()`, recalculates the selected string immediately;
   * upcoming and revisited strings are calculated when selected. Stored tokens and
   * playback timing are unchanged. Sessions loaded through `loadTokens()` retain their
   * supplied offsets. The preference survives Stop, reset, and subsequent loads.
   *
   * @param strategy - Presentation strategy, or `undefined` to restore original token offsets.
   */
  public setOvpStrategy(strategy: OvpStrategy | undefined): void {
    this.#execute(() => {
      if (this.state === "ERROR") {
        throw new InvalidInputError({
          message: "Cannot set an OVP strategy while engine is ERROR.",
        });
      }
      if (strategy !== undefined && typeof strategy?.calculate !== "function") {
        throw new InvalidInputError({ message: "OVP strategy must provide a calculate function." });
      }
      const item = this.#createPresentationItem(
        this.#tokens[this.#presentation.index] ?? null,
        this.#isExternalTokens ? undefined : strategy,
      );
      this.#ovpStrategy = strategy;
      if (item?.ovpIndex !== this.#presentation.item?.ovpIndex) {
        this.#presentation.item = item;
      }
      this.#publishNotification("ovpChanged");
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
    return this.#presentation.index;
  }

  /** Selected item, or null for empty data. */
  public get currentItem(): RsvpItem<T> | null {
    return this.#presentation.item;
  }

  /** Position as a fraction of loaded items; reaches one after the final display period. */
  public get progress(): number {
    if (this.#tokens.length === 0) {
      return 0;
    }
    switch (this.state) {
      case "ERROR":
        // Playback and navigation failures retain the last published progress.
        return this.#snapshot.progress;
      case "COMPLETED":
        return 1;
      case "IDLE":
      case "PLAYING":
      case "PAUSED":
      case "STOPPED":
        return this.#presentation.index / this.#tokens.length;
    }
  }

  /** Number of loaded items. */
  public get totalItems(): number {
    return this.#tokens.length;
  }

  /** Reads cached immutable playback state. Do not read after destroy. */
  readonly getSnapshot = (): RsvpSnapshot<T> => this.#snapshot;

  /**
   * Subscribes without invoking the callback immediately.
   * Synchronous listener failures are isolated and reported through onError or the host.
   */
  readonly subscribe = (listener: RsvpStoreListener<T>): UnsubscribeFn => {
    this.#assertNotDestroyed();
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #clearSessionData(): void {
    this.#tokens = [];
    this.#suffixMultiplierSums = new Float64Array(1);
    this.#presentation = { index: 0, item: null, deadlineAtMs: 0, remainingMs: 0 };
    this.#isExternalTokens = false;
    this.#remainingTimeChanged = false;
  }

  #loadTokens(tokens: Token<T>[], isExternalTokens = false): void {
    this.#assertCanLoad();
    validateTokens(tokens);
    const loadedTokens = tokens.map((token) =>
      Object.freeze({
        value: token.value,
        ovpIndex: token.ovpIndex,
        durationMultiplier: token.durationMultiplier,
      }),
    );

    try {
      this.#stateMachine.transition("load");
      this.#cancelAdvance();
      this.#clearSessionData();
      this.#tokens = loadedTokens;
      this.#isExternalTokens = isExternalTokens;
      this.#suffixMultiplierSums = new Float64Array(loadedTokens.length + 1);
      for (let index = loadedTokens.length - 1; index >= 0; index--) {
        this.#suffixMultiplierSums[index] =
          this.#suffixMultiplierSums[index + 1] + loadedTokens[index].durationMultiplier;
      }
      this.#selectItem(0);
      this.#publishNotification("loaded");
    } catch (error) {
      if (error instanceof UndeliveredError) {
        throw error;
      }
      this.#clearSessionData();
      throw new SessionLoadError({ cause: error });
    }
  }

  // Derive a presentation without changing the stored token or playback state.
  // Strategy failures propagate to the caller's error policy.
  #createPresentationItem(token: Token<T> | null, ovpStrategy?: OvpStrategy): RsvpItem<T> | null {
    if (token === null) {
      return null;
    }
    let item: RsvpItem<T> = token;

    if (ovpStrategy && typeof token.value === "string") {
      const text = token.value;
      const ovpIndex = this.#runStrategy(() => ovpStrategy.calculate(text));
      if (ovpIndex !== token.ovpIndex) {
        item = { ...item, ovpIndex };
      }
    }

    if (item !== token) {
      validateTokens([item]);
      return Object.freeze(item);
    }

    return item;
  }

  // Select with a full display period; index zero also supports an empty session.
  // Reuse an existing presentation at the same index, without scheduling playback.
  #selectItem(index: number): void {
    const ovpStrategy = this.#isExternalTokens ? undefined : this.#ovpStrategy;
    const token = this.#tokens[index] ?? null;
    const item =
      index === this.#presentation.index && this.#presentation.item !== null
        ? this.#presentation.item
        : this.#createPresentationItem(token, ovpStrategy);
    const remainingMs = token === null ? 0 : this.msPerItem * token.durationMultiplier;
    this.#remainingTimeChanged = this.#presentation.remainingMs !== remainingMs;
    this.#presentation = { index, item, deadlineAtMs: 0, remainingMs };
  }

  // Requires PLAYING with a selected item whose display period has expired.
  #advanceToNextItem(): void {
    const nextIndex = this.#presentation.index + 1;
    if (nextIndex === this.#tokens.length) {
      this.#cancelAdvance();
      this.#presentation.deadlineAtMs = 0;
      this.#presentation.remainingMs = 0;
      this.#stateMachine.transition("complete");
      this.#publishNotification("completed");
      return;
    }
    try {
      this.#selectItem(nextIndex);
    } catch (error) {
      throw new ItemSelectionError(nextIndex, { cause: error });
    }
    this.#scheduleAdvance(this.#presentation.remainingMs);
    this.#publishNotification("advanced");
  }

  // Requires PLAYING and a positive, finite delay in milliseconds.
  #scheduleAdvance(delayMs: number): void {
    const revision = ++this.#scheduleRevision;
    try {
      this.#presentation.deadlineAtMs = this.#readTime() + delayMs;
      this.#scheduler.schedule(() => {
        if (revision === this.#scheduleRevision && this.state === "PLAYING") {
          this.#execute(() => this.#advanceToNextItem(), "scheduler");
        }
      }, delayMs);

      const deadline = this.#scheduler.getDeadline?.() ?? this.#presentation.deadlineAtMs;
      if (!Number.isFinite(deadline)) {
        throw new RangeError("Scheduler deadline must be finite.");
      }
      this.#presentation.deadlineAtMs = deadline;
    } catch (error) {
      throw new PlaybackSchedulingError({ cause: error });
    }
  }

  #cancelAdvance(): void {
    this.#scheduleRevision++;
    try {
      this.#scheduler.cancel();
    } catch (error) {
      throw new PlaybackSchedulingError({ message: "Failed to cancel playback.", cause: error });
    }
  }

  #readTime(): number {
    try {
      const now = this.#timeDriver.now();
      if (!Number.isFinite(now)) {
        throw new RangeError("Engine clock must return a finite timestamp.");
      }
      return now;
    } catch (error) {
      throw new EngineError("Failed to read engine clock.", { cause: error, isFatal: true });
    }
  }

  #execute(action: () => void, source: "command" | "scheduler" = "command"): void {
    this.#assertNotDestroyed();
    this.#assertNotExecutingStrategy();
    try {
      action();
    } catch (error) {
      if (error instanceof UndeliveredError) {
        throw error;
      }
      const err = this.#handleError(error);
      if (source === "command") {
        throw err;
      }
      this.#dispatchError(err);
      return;
    }
  }

  #transition(action: "play" | "pause" | "stop" | "seek" | "reset"): void {
    this.#stateMachine.transition(action);
  }

  #navigateTo(index: number): void {
    this.#transition("seek");
    try {
      this.#selectItem(index);
    } catch (error) {
      throw new ItemSelectionError(index, { cause: error });
    }
    this.#publishNotification("navigated");
  }

  #navigateBy(offset: number, command: string): void {
    this.#execute(() => {
      if (this.state !== "PAUSED") {
        throw new InvalidInputError({ message: `${command}() is only available in PAUSED state.` });
      }
      const index = this.#presentation.index + offset;
      if (index < 0 || index >= this.#tokens.length) {
        return;
      }
      this.#navigateTo(index);
    });
  }

  #handleError(error: unknown): EngineError {
    const err = error instanceof EngineError ? error : new EngineError(undefined, { cause: error });

    if (err.isFatal) {
      if (this.state !== "ERROR") {
        this.#stateMachine.transition("error");
      }
      try {
        this.#cancelAdvance();
      } catch {
        // Cancellation must not replace the original failure; stale callbacks are already invalidated.
      }
      this.#presentation.deadlineAtMs = 0;
      this.#presentation.remainingMs = 0;

      try {
        this.#publishNotification("stateChanged");
      } catch (reportingError) {
        if (!(reportingError instanceof UndeliveredError)) {
          throw reportingError;
        }
        // Preserve the original engine failure when diagnostics cannot reach the host.
      }
    }
    return err;
  }

  #dispatchError(error: EngineError | ListenerError): void {
    if (this.#onError && !this.#reportingError) {
      this.#reportingError = true;
      try {
        this.#onError(error);
        return;
      } catch (reporterError) {
        this.#dispatchUnhandledError(
          new AggregateError([error, reporterError], "Error handler failed."),
        );
        return;
      } finally {
        this.#reportingError = false;
      }
    }
    this.#dispatchUnhandledError(error);
  }

  #dispatchUnhandledError(error: unknown): void {
    const report = () => {
      throw error;
    };
    try {
      const runtimeGlobal = globalThis as RuntimeGlobal;
      if (typeof runtimeGlobal.queueMicrotask === "function") {
        runtimeGlobal.queueMicrotask(report);
      } else {
        this.#timeDriver.setTimeout(report, 0);
      }
    } catch (cause) {
      throw new UndeliveredError([error, cause], { cause });
    }
  }

  #assertCanLoad(): void {
    if (this.state === "PLAYING" || this.state === "ERROR") {
      throw new InvalidInputError({ message: `Cannot load data while engine is ${this.state}.` });
    }
  }

  #assertNotDestroyed(): void {
    if (this.#destroyed) {
      throw new EngineDestroyedError();
    }
  }

  #assertNotExecutingStrategy(): void {
    if (this.#executingStrategy) {
      throw new InvalidInputError({
        message: "Cannot mutate the engine while a strategy is executing.",
      });
    }
  }

  // Guard only the synchronous callback; preparation and notifications remain outside it.
  #runStrategy<Result>(callback: () => Result): Result {
    this.#assertNotExecutingStrategy();
    this.#executingStrategy = true;
    try {
      return callback();
    } finally {
      this.#executingStrategy = false;
    }
  }

  #createSnapshot(): RsvpSnapshot<T> {
    return Object.freeze({
      state: this.state,
      currentIndex: this.#presentation.index,
      currentItem: this.currentItem,
      progress: this.progress,
      totalItems: this.totalItems,
      wpm: this.wpm,
      msPerItem: this.msPerItem,
      timing: this.#timing,
    });
  }

  #updateSnapshot(eventType: RsvpEventType): boolean {
    const previous = this.#snapshot;
    if (
      previous.state !== this.state ||
      (previous.currentItem !== this.currentItem && eventType !== "ovpChanged") ||
      previous.msPerItem !== this.msPerItem ||
      this.#remainingTimeChanged
    ) {
      this.#refreshTiming();
    }
    this.#remainingTimeChanged = false;
    const changed =
      previous.state !== this.state ||
      previous.currentIndex !== this.#presentation.index ||
      previous.currentItem !== this.currentItem ||
      previous.progress !== this.progress ||
      previous.totalItems !== this.totalItems ||
      previous.wpm !== this.wpm ||
      previous.msPerItem !== this.msPerItem ||
      previous.timing !== this.#timing;
    if (!changed) {
      return false;
    }
    this.#snapshot = this.#createSnapshot();
    return true;
  }

  #publishNotification(eventType: RsvpEventType): void {
    if (!this.#updateSnapshot(eventType)) {
      return;
    }
    this.#notificationQueue.push({ snapshot: this.#snapshot, eventType });
    this.#sendNotifications();
  }

  #sendNotifications(): void {
    if (this.#notifying || this.#notificationQueue.length === 0) {
      return;
    }
    this.#notifying = true;
    let reportingFailures: UndeliveredError[] | undefined;
    try {
      while (this.#notificationQueue.length && !this.#destroyed) {
        const { snapshot, eventType } = this.#notificationQueue.shift()!;
        for (const listener of Array.from(this.#listeners)) {
          if (this.#destroyed) {
            break;
          }
          try {
            listener(snapshot, eventType);
          } catch (error) {
            try {
              this.#dispatchError(new ListenerError(eventType, { cause: error }));
            } catch (reportingError) {
              if (!(reportingError instanceof UndeliveredError)) {
                throw reportingError;
              }
              (reportingFailures ??= []).push(reportingError);
            }
          }
        }
      }
    } finally {
      this.#notificationQueue.length = 0;
      this.#notifying = false;
    }
    if (reportingFailures) {
      throw reportingFailures.length === 1
        ? reportingFailures[0]
        : new UndeliveredError(reportingFailures);
    }
  }

  #refreshTiming(): void {
    // Fatal reporting must remain possible when the clock itself has failed.
    const sampledAtMs = this.state === "ERROR" ? this.#timing.sampledAtMs : this.#readTime();
    const totalDurationMs = this.#suffixMultiplierSums[0] * this.msPerItem;
    let remainingDurationMs: number | null = totalDurationMs;

    if (this.state === "ERROR") {
      remainingDurationMs = null;
    } else if (this.state === "COMPLETED") {
      remainingDurationMs = 0;
    } else if (this.state === "PLAYING") {
      remainingDurationMs =
        Math.max(0, this.#presentation.deadlineAtMs - sampledAtMs) +
        this.#suffixMultiplierSums[this.#presentation.index + 1] * this.msPerItem;
    } else if (this.state === "PAUSED") {
      remainingDurationMs =
        this.#presentation.remainingMs +
        this.#suffixMultiplierSums[this.#presentation.index + 1] * this.msPerItem;
    }

    if (
      this.#timing.totalDurationMs !== totalDurationMs ||
      this.#timing.remainingDurationMs !== remainingDurationMs ||
      this.#timing.sampledAtMs !== sampledAtMs
    ) {
      this.#timing = Object.freeze({ totalDurationMs, remainingDurationMs, sampledAtMs });
    }
  }
}
