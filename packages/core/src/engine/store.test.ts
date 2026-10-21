import type { RsvpEngineOptions } from "./config";
import type { RsvpSnapshot } from "./types";
import type { SchedulerStrategy } from "../scheduler/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EngineDestroyedError,
  EngineError,
  InvalidInputError,
  ListenerError,
  PlaybackSchedulingError,
  TokenizationError,
} from "../errors";
import { DefaultTokenizer } from "../tokenizer/default-tokenizer";

import { RsvpEngine } from "./rsvp-engine";

describe("Core observable store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function createEngine(options: RsvpEngineOptions<string> = {}): RsvpEngine<string> {
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 600,
      ...options,
    });
    engine.load("one two");
    return engine;
  }

  it("returns a flat cached immutable playback snapshot", () => {
    const engine = createEngine();
    const initial = engine.getSnapshot();
    expect(engine.getSnapshot()).toBe(initial);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(initial).toMatchObject({ state: "IDLE", progress: 0, totalItems: 2 });
    expect(Object.isFrozen(initial.currentItem)).toBe(true);

    expect(() => engine.pause()).toThrow();
    const failed = engine.getSnapshot();
    expect(failed).toBe(initial);
    engine.setWpm(300);
    expect(engine.getSnapshot().currentItem).toBe(initial.currentItem);
    engine.destroy();
  });

  it("passes the cached flat snapshot and the event type to its listener", () => {
    const engine = createEngine();
    const observed: RsvpSnapshot<string>[] = [];
    const listener = vi.fn((snapshot: RsvpSnapshot<string>) => {
      expect(snapshot).toBe(engine.getSnapshot());
      observed.push(snapshot);
    });
    engine.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
    engine.play();
    expect(listener.mock.calls[0]).toHaveLength(2);
    expect(observed[0]).toMatchObject({ state: "PLAYING", progress: 0 });
    engine.pause();
    expect(observed[0].state).toBe("PLAYING");
    expect(observed[1].state).toBe("PAUSED");
    expect(() => engine.seek(-1)).toThrow();
    expect(observed).toHaveLength(2);
    engine.destroy();
  });

  it("publishes one complete state per command, token, and completion", () => {
    const engine = createEngine();
    const observed: unknown[] = [];
    engine.subscribe((snapshot) => {
      observed.push({
        state: snapshot.state,
        index: snapshot.currentIndex,
        progress: snapshot.progress,
      });
      if (snapshot.state === "PLAYING") {
        expect(vi.getTimerCount()).toBe(1);
      }
    });
    engine.play();
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    expect(observed).toEqual([
      { state: "PLAYING", index: 0, progress: 0 },
      { state: "PLAYING", index: 1, progress: 0.5 },
      { state: "COMPLETED", index: 1, progress: 1 },
    ]);
    engine.destroy();
  });

  it("reports load and speed changes, but skips unchanged values and navigation boundaries", () => {
    const engine = createEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setWpm(600);
    engine.setMsPerItem(100);
    expect(listener).not.toHaveBeenCalled();
    engine.load("new content");
    expect(listener).toHaveBeenCalledTimes(1);
    engine.play();
    engine.pause();
    const paused = engine.getSnapshot();
    engine.seek(0);
    engine.previous();
    expect(engine.getSnapshot()).toBe(paused);
    engine.next();
    const last = engine.getSnapshot();
    engine.next();
    expect(engine.getSnapshot()).toBe(last);
    expect(listener).toHaveBeenCalledTimes(4);
    engine.destroy();
  });

  it("observes exact speed-unit changes even when the interval is unchanged", () => {
    const engine = createEngine({ wpm: 225 });
    const listener = vi.fn();
    engine.subscribe(listener);
    const interval = engine.msPerItem;
    engine.setMsPerItem(interval);
    expect(engine.getSnapshot().wpm).toBe(60_000 / interval);
    expect(listener).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it("throws validation failures without changing playback or reporting through onError", () => {
    const onError = vi.fn();
    const engine = createEngine({ onError });
    engine.play();
    const playback = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);
    let thrown: unknown;
    try {
      engine.load("replacement");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InvalidInputError);
    expect(engine.getSnapshot()).toBe(playback);
    expect(listener).not.toHaveBeenCalled();
    expect(() => engine.setWpm(0)).toThrow(InvalidInputError);
    expect(engine.getSnapshot()).toBe(playback);
    expect(onError).not.toHaveBeenCalled();
    engine.destroy();
  });

  it.each(["schedule", "cancel"] as const)(
    "publishes fatal %s failures even if cleanup fails",
    (stage) => {
      const fatal = new Error("scheduler failure");
      let cancelFailure: Error | undefined;
      const scheduler: SchedulerStrategy = {
        cancel: () => {
          if (cancelFailure) {
            throw cancelFailure;
          }
        },
        schedule: () => {
          if (stage === "schedule") {
            throw fatal;
          }
        },
      };
      const engine = createEngine({ scheduler });
      if (stage === "cancel") {
        engine.play();
      }
      const listener = vi.fn();
      engine.subscribe(listener);
      cancelFailure = stage === "schedule" ? new Error("cleanup failure") : fatal;
      let thrown: unknown;
      try {
        if (stage === "schedule") {
          engine.play();
        } else {
          engine.pause();
        }
      } catch (error) {
        thrown = error;
      }
      expect(listener).toHaveBeenCalledOnce();
      expect(thrown).toBeInstanceOf(EngineError);
      expect(thrown).toMatchObject({ isFatal: true, cause: fatal });
      expect(engine.getSnapshot().state).toBe("ERROR");
      cancelFailure = undefined;
      expect(engine.state).toBe("ERROR");
      expect(() => engine.load("replacement")).toThrow(InvalidInputError);
      listener.mockClear();
      engine.reset();
      expect(listener).toHaveBeenCalledOnce();
      expect(engine.getSnapshot()).toMatchObject({
        state: "IDLE",
        totalItems: 0,
      });
      engine.destroy();
    },
  );

  it.each(["primitive", "fatal input"] as const)(
    "publishes %s tokenizer failures before throwing",
    (kind) => {
      const failure =
        kind === "primitive"
          ? "tokenizer failure"
          : new InvalidInputError({
              cause: new EngineError("fatal source", { isFatal: true }),
            });
      const engine = new RsvpEngine({
        tokenizer: {
          tokenize: () => {
            throw failure;
          },
        },
      });
      engine.loadTokens([
        { value: "one", ovpIndex: 0, durationMultiplier: 1 },
        { value: "two", ovpIndex: 0, durationMultiplier: 1 },
      ]);
      engine.seek(1);
      const listener = vi.fn();
      engine.subscribe(listener);
      let thrown: unknown;
      try {
        engine.load("input");
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(EngineError);
      expect(thrown).toMatchObject({ cause: failure });
      expect(thrown).toBeInstanceOf(TokenizationError);
      expect(thrown).toMatchObject({ name: "TokenizationError", isFatal: true });
      expect(listener).toHaveBeenCalledOnce();
      expect(engine.getSnapshot()).toMatchObject({
        state: "ERROR",
        currentIndex: 0,
        currentItem: null,
        totalItems: 0,
        progress: 0,
        timing: { totalDurationMs: 0, remainingDurationMs: null },
      });
      engine.reset();
      engine.destroy();
    },
  );

  it("supports duplicate listeners, unsubscription, and commands inside notifications", () => {
    const engine = createEngine();
    const first = vi.fn(() => {
      if (engine.state === "PLAYING") {
        engine.pause();
      }
    });
    engine.subscribe(first);
    const unsubscribe = engine.subscribe(first);
    const second = vi.fn();
    engine.subscribe(second);
    engine.play();
    expect(engine.state).toBe("PAUSED");
    expect(vi.getTimerCount()).toBe(0);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    unsubscribe();
    unsubscribe();
    engine.setWpm(300);
    expect(first).toHaveBeenCalledTimes(2);
    engine.destroy();
  });

  it("ignores cancelled callbacks after a subscriber pauses and resumes playback", () => {
    const tasks: (() => void)[] = [];
    const scheduler: SchedulerStrategy = {
      cancel: vi.fn(),
      schedule: (task) => {
        tasks.push(task);
      },
    };
    const engine = createEngine({ scheduler });
    engine.play();
    engine.pause();
    engine.play();
    const before = engine.getSnapshot();
    tasks[0]();
    expect(engine.getSnapshot()).toBe(before);
    tasks[1]();
    expect(engine.currentIndex).toBe(1);
    engine.destroy();
  });

  it("reports subscriber exceptions without changing playback or blocking other listeners", () => {
    const onError = vi.fn();
    const engine = createEngine({ onError });
    const failure = new EngineError("subscriber failure", { isFatal: true });
    const unsubscribe = engine.subscribe(() => {
      throw failure;
    });
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.play()).not.toThrow();
    expect(engine.getSnapshot()).toMatchObject({ state: "PLAYING" });
    expect(listener).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
    const reported = onError.mock.calls[0]![0] as ListenerError;
    expect(reported).toBeInstanceOf(ListenerError);
    expect(reported).not.toBeInstanceOf(EngineError);
    expect(reported).not.toHaveProperty("isFatal");
    expect(reported.eventType).toBe("started");
    expect(reported.cause).toBe(failure);
    unsubscribe();
    listener.mockClear();
    engine.pause();
    expect(listener).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it.each(["callback", "unavailable"] as const)(
    "preserves the original command failure when listener reporting is %s",
    (reporting) => {
      const onError = vi.fn();
      const commandFailure = new Error("schedule failed");
      vi.stubGlobal("queueMicrotask", () => {
        throw new Error("host reporting unavailable");
      });
      const engine = createEngine({
        onError: reporting === "callback" ? onError : undefined,
        scheduler: {
          cancel: vi.fn(),
          schedule: () => {
            throw commandFailure;
          },
        },
      });
      const subscriberFailure = new Error("subscriber failure");
      engine.subscribe(() => {
        throw subscriberFailure;
      });
      const listener = vi.fn();
      engine.subscribe(listener);
      let thrown: unknown;
      try {
        engine.play();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(PlaybackSchedulingError);
      expect(thrown).toMatchObject({ cause: commandFailure });
      expect(listener).toHaveBeenCalledOnce();
      if (reporting === "callback") {
        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0]![0]).toMatchObject({
          eventType: "stateChanged",
          cause: subscriberFailure,
        });
      } else {
        expect(onError).not.toHaveBeenCalled();
      }
      engine.destroy();
    },
  );

  it.each([
    { transport: "microtask", command: "play", listenerFailures: 1 },
    { transport: "timer", command: "load", listenerFailures: 2 },
  ] as const)(
    "keeps committed $command playback and delivers other listeners when $transport reporting fails",
    ({ transport, command, listenerFailures }) => {
      const reportingFailure = new EngineError("host reporting unavailable", { isFatal: true });
      const unavailable = () => {
        throw reportingFailure;
      };
      vi.stubGlobal("queueMicrotask", transport === "microtask" ? unavailable : undefined);
      const engine = createEngine({
        scheduler: { schedule: vi.fn(), cancel: vi.fn() },
        timeDriver: { now: () => 0, setTimeout: unavailable, clearTimeout: vi.fn() },
      });
      const subscriberFailure = new Error("subscriber failed");
      for (let index = 0; index < listenerFailures; index++) {
        engine.subscribe((_, eventType) => {
          if (eventType !== (command === "load" ? "loaded" : "started")) {
            return;
          }
          if (command === "load" && index === 0) {
            engine.setWpm(900);
          }
          throw subscriberFailure;
        });
      }
      const listener = vi.fn();
      engine.subscribe(listener);
      let thrown: unknown;
      try {
        if (command === "load") {
          engine.load("replacement");
        } else {
          engine.play();
        }
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(AggregateError);
      expect(thrown).not.toBeInstanceOf(EngineError);
      const failures: readonly unknown[] =
        listenerFailures === 1 ? [thrown] : (thrown as AggregateError).errors;
      expect(failures).toHaveLength(listenerFailures);
      for (const failure of failures) {
        expect(failure).toBeInstanceOf(AggregateError);
        expect((failure as AggregateError).errors).toEqual([
          expect.objectContaining({
            eventType: command === "load" ? "loaded" : "started",
            cause: subscriberFailure,
          }),
          reportingFailure,
        ]);
      }
      expect(engine.getSnapshot()).toMatchObject({
        state: command === "load" ? "IDLE" : "PLAYING",
        currentItem: { value: command === "load" ? "replacement" : "one" },
        totalItems: command === "load" ? 1 : 2,
        wpm: command === "load" ? 900 : 600,
      });
      expect(listener.mock.calls.map(([, eventType]) => eventType)).toEqual(
        command === "load" ? ["loaded", "speedChanged"] : ["started"],
      );
      engine.destroy();
    },
  );

  it.each(["command", "scheduler"] as const)(
    "reports unhandled %s listener failures asynchronously",
    (source) => {
      let report: () => void = vi.fn();
      const enqueue = vi.fn((task: () => void) => {
        report = task;
      });
      vi.stubGlobal("queueMicrotask", enqueue);
      const engine = createEngine();
      const event = source === "command" ? "started" : "advanced";
      engine.subscribe((_, eventType) => {
        if (eventType === event) {
          throw new Error("listener failed");
        }
      });
      const listener = vi.fn();
      engine.subscribe(listener);
      expect(() => engine.play()).not.toThrow();
      if (source === "scheduler") {
        listener.mockClear();
        expect(() => vi.advanceTimersByTime(100)).not.toThrow();
      }
      expect(listener).toHaveBeenCalledOnce();
      expect(enqueue).toHaveBeenCalledOnce();
      expect(engine.getSnapshot()).toMatchObject({ state: "PLAYING" });
      expect(report).toThrow(ListenerError);
      engine.destroy();
    },
  );

  it("uses the injected timer when microtasks are unavailable", () => {
    vi.stubGlobal("queueMicrotask", undefined);
    let report: () => void = vi.fn();
    const setTimeout = vi.fn((task: () => void) => {
      report = task;
    });
    const engine = createEngine({
      timeDriver: { now: () => 0, setTimeout, clearTimeout: vi.fn() },
    });
    engine.subscribe(() => {
      throw "listener failed";
    });
    expect(() => engine.setWpm(450)).not.toThrow();
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
    expect(report).toThrow(ListenerError);
    expect(engine.getSnapshot().state).toBe("IDLE");
    engine.destroy();
  });

  it("reports a failing error handler without recursion or interrupting delivery", () => {
    let report: () => void = vi.fn();
    vi.stubGlobal("queueMicrotask", (task: () => void) => {
      report = task;
    });
    const reporterFailure = new Error("reporter failed");
    const onError = vi.fn<NonNullable<RsvpEngineOptions["onError"]>>(() => {
      throw reporterFailure;
    });
    const engine = createEngine({ onError });
    const failure = new Error("listener failed");
    engine.subscribe(() => {
      throw failure;
    });
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.play()).not.toThrow();
    expect(listener).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
    expect(engine.getSnapshot()).toMatchObject({ state: "PLAYING" });
    let unhandled: unknown;
    try {
      report();
    } catch (error) {
      unhandled = error;
    }
    expect(unhandled).toBeInstanceOf(AggregateError);
    expect((unhandled as AggregateError).errors).toEqual([
      onError.mock.calls[0]![0],
      reporterFailure,
    ]);
    engine.destroy();
  });

  it("reports timer failures to the host when onError is omitted", () => {
    const reports: (() => void)[] = [];
    vi.stubGlobal("queueMicrotask", (task: () => void) => reports.push(task));
    let callback: () => void = vi.fn();
    let schedules = 0;
    const failure = new Error("schedule failed");
    const engine = createEngine({
      scheduler: {
        cancel: vi.fn(),
        schedule: (task) => {
          if (++schedules === 2) {
            throw failure;
          }
          callback = task;
        },
      },
    });
    engine.play();
    expect(() => callback()).not.toThrow();
    expect(engine.state).toBe("ERROR");
    expect(reports).toHaveLength(1);
    expect(reports[0]).toThrow(expect.objectContaining({ cause: failure, isFatal: true }));
    engine.destroy();
  });

  it("does not re-enter onError when its command causes another listener failure", () => {
    const reports: (() => void)[] = [];
    vi.stubGlobal("queueMicrotask", (task: () => void) => reports.push(task));
    let callback: () => void = vi.fn();
    let schedules = 0;
    const onError = vi.fn(() => engine.setWpm(300));
    const engine = createEngine({
      onError,
      scheduler: {
        cancel: vi.fn(),
        schedule: (task) => {
          if (++schedules === 2) {
            throw new Error("schedule failed");
          }
          callback = task;
        },
      },
    });
    const failure = new Error("speed listener failed");
    engine.subscribe((_, eventType) => {
      if (eventType === "speedChanged") {
        throw failure;
      }
    });
    engine.play();
    expect(() => callback()).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]).toHaveLength(1);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toThrow(
      expect.objectContaining({ cause: failure, eventType: "speedChanged" }),
    );
    engine.destroy();
  });

  it("ends the instance lifetime even when scheduler cancellation fails", () => {
    let fail = false;
    const engine = createEngine({
      scheduler: {
        schedule: vi.fn(),
        cancel: () => {
          if (fail) {
            throw new Error("cancel failed");
          }
        },
      },
    });
    fail = true;
    expect(() => engine.destroy()).toThrow(PlaybackSchedulingError);
    expect(() => engine.play()).toThrow(EngineDestroyedError);
    expect(() => engine.subscribe(vi.fn())).toThrow(EngineDestroyedError);
    expect(() => engine.destroy()).not.toThrow();
  });

  it("ends playback and notification delivery on destroy while preserving captured snapshots", () => {
    const engine = createEngine();
    const delivered: RsvpSnapshot<string>[] = [];
    engine.subscribe((snapshot) => {
      delivered.push(snapshot);
      engine.setWpm(300);
      engine.destroy();
    });
    const second = vi.fn();
    const unsubscribe = engine.subscribe(second);
    engine.play();
    expect(delivered).toEqual([
      expect.objectContaining({
        state: "PLAYING",
        wpm: 600,
        currentItem: expect.objectContaining({ value: "one" }),
      }),
    ]);
    expect(Object.isFrozen(delivered[0])).toBe(true);
    expect(second).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
    unsubscribe();
    unsubscribe();
    vi.runAllTimers();
    expect(delivered).toHaveLength(1);
    expect(() => engine.subscribe(vi.fn())).toThrow(EngineDestroyedError);
    expect(() => engine.play()).toThrow(EngineDestroyedError);
  });
});
