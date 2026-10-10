import type { RsvpEngineOptions } from "./config";
import type { RsvpSnapshot } from "./types";
import type { SchedulerStrategy } from "../scheduler/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineDestroyedError, InvalidInputError } from "../errors";

import { RsvpEngine } from "./rsvp-engine";

describe("Core observable store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function createEngine(options: RsvpEngineOptions<string> = {}): RsvpEngine<string> {
    return new RsvpEngine({ data: "one two", wpm: 600, ...options });
  }

  it("returns a flat cached snapshot with readonly playback and error fields", () => {
    const engine = createEngine();
    const initial = engine.getSnapshot();
    expect(engine.getSnapshot()).toBe(initial);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(initial).toMatchObject({ state: "IDLE", progress: 0, totalItems: 2 });
    expect(initial).not.toHaveProperty("snapshot");
    expect(Object.isFrozen(initial.currentItem)).toBe(true);
    expect(initial.error).toBeNull();

    engine.pause();
    const failed = engine.getSnapshot();
    expect(failed).not.toBe(initial);
    expect(failed).toEqual({ ...initial, error: failed.error });
    expect(failed.error).toBeInstanceOf(Error);
    engine.setWpm(300);
    expect(engine.getSnapshot().error).toBe(failed.error);
    expect(engine.getSnapshot().currentItem).toBe(initial.currentItem);
    expect(initial.error).toBeNull();
    engine.clearError();
    expect(engine.getSnapshot().error).toBeNull();
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
    expect(observed[0]).toMatchObject({ state: "PLAYING", progress: 0.5, error: null });
    engine.pause();
    expect(observed[0].state).toBe("PLAYING");
    expect(observed[1].state).toBe("PAUSED");
    engine.seek(-1);
    expect(observed[2].error).toBeInstanceOf(Error);
    expect(observed[2].state).toBe("PAUSED");
    engine.destroy();
  });

  it("publishes one complete state per command, token, and completion", () => {
    const engine = createEngine();
    const observed: unknown[] = [];
    engine.subscribe((snapshot) => {
      const { error } = snapshot;
      observed.push({
        state: snapshot.state,
        index: snapshot.currentIndex,
        progress: snapshot.progress,
        error,
      });
      if (snapshot.state === "PLAYING") {
        expect(vi.getTimerCount()).toBe(1);
      }
    });
    engine.play();
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    expect(observed).toEqual([
      { state: "PLAYING", index: 0, progress: 0.5, error: null },
      { state: "PLAYING", index: 1, progress: 1, error: null },
      { state: "COMPLETED", index: 1, progress: 1, error: null },
    ]);
    engine.destroy();
  });

  it("reports load and speed changes, but skips unchanged values and navigation boundaries", () => {
    const engine = createEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setWpm(600);
    engine.setMsPerItem(100);
    engine.clearError();
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

  it.each(["load", "loadTokens"] as const)(
    "clears errors with a successful %s in the same notification",
    (method) => {
      const engine = createEngine();
      engine.pause();
      const listener = vi.fn();
      engine.subscribe(listener);
      if (method === "load") {
        engine.load("replacement");
      } else {
        engine.loadTokens([{ value: "replacement", ovpIndex: 0, durationMultiplier: 1 }]);
      }
      expect(listener).toHaveBeenCalledOnce();
      expect(engine.getSnapshot()).toMatchObject({
        state: "IDLE",
        totalItems: 1,
        error: null,
      });
      engine.destroy();
    },
  );

  it("records thrown validation failures while preserving playback, then rethrows", () => {
    const engine = createEngine();
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
    expect(engine.getSnapshot()).toEqual({ ...playback, error: engine.getSnapshot().error });
    expect(engine.getSnapshot().error).toBe(thrown);
    expect(listener).toHaveBeenCalledOnce();
    expect(() => engine.setWpm(0)).toThrow(InvalidInputError);
    expect(engine.getSnapshot()).toEqual({ ...playback, error: engine.getSnapshot().error });
    engine.destroy();
  });

  it("publishes fatal state and error atomically and clears both on reset", () => {
    const fatal = new Error("scheduler failure");
    const scheduler: SchedulerStrategy = {
      cancel: vi.fn(),
      schedule: () => {
        throw fatal;
      },
    };
    const engine = createEngine({ scheduler });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.play();
    expect(listener).toHaveBeenCalledOnce();
    expect(engine.getSnapshot()).toMatchObject({ state: "ERROR", error: fatal });
    engine.clearError();
    expect(engine.state).toBe("ERROR");
    expect(engine.getSnapshot().error).toBeNull();
    expect(() => engine.load("replacement")).toThrow(InvalidInputError);
    expect(engine.getSnapshot().error).toBeInstanceOf(InvalidInputError);
    listener.mockClear();
    engine.reset();
    expect(listener).toHaveBeenCalledOnce();
    expect(engine.getSnapshot()).toMatchObject({
      state: "IDLE",
      totalItems: 0,
      error: null,
    });
    engine.destroy();
  });

  it("publishes tokenizer failures before rethrowing the original value", () => {
    const engine = createEngine({
      data: undefined,
      tokenizer: {
        tokenize: () => {
          throw "tokenizer failure";
        },
      },
    });
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.load("input")).toThrow("tokenizer failure");
    expect(listener).toHaveBeenCalledOnce();
    expect(engine.getSnapshot()).toMatchObject({
      state: "ERROR",
      error: { message: "tokenizer failure" },
    });
    engine.reset();
    expect(engine.getSnapshot().error).toBeNull();
    engine.destroy();
  });

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

  it("propagates subscriber exceptions without recording them as engine failures", () => {
    const engine = createEngine();
    const failure = new Error("subscriber failure");
    const unsubscribe = engine.subscribe(() => {
      throw failure;
    });
    expect(() => engine.play()).toThrow(failure);
    expect(engine.getSnapshot()).toMatchObject({ state: "PLAYING", error: null });
    unsubscribe();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.pause();
    expect(listener).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it("preserves the original command failure when a subscriber also throws", () => {
    const engine = createEngine();
    const subscriberFailure = new Error("subscriber failure");
    engine.subscribe(() => {
      throw subscriberFailure;
    });
    let thrown: unknown;
    try {
      engine.setWpm(0);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InvalidInputError);
    expect(engine.getSnapshot().error).toBe(thrown);
    engine.destroy();
  });

  it("keeps the last store readable after destroy and rejects further commands and subscriptions", () => {
    const engine = createEngine();
    engine.subscribe(() => engine.destroy());
    engine.play();
    const final = engine.getSnapshot();
    expect(final.state).toBe("PLAYING");
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
    expect(engine.getSnapshot()).toBe(final);
    expect(() => engine.subscribe(vi.fn())).toThrow(EngineDestroyedError);
    expect(() => engine.play()).toThrow(EngineDestroyedError);
    expect(() => engine.clearError()).toThrow(EngineDestroyedError);
    expect(engine).not.toHaveProperty("on");
    expect(engine).not.toHaveProperty("snapshot");
  });
});
