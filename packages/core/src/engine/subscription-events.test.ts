import type { RsvpEventType, RsvpSnapshot } from "./types";
import type { SchedulerStrategy } from "../scheduler/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidInputError, ListenerError, PlaybackSchedulingError } from "../errors";
import { DefaultTokenizer } from "../tokenizer/default-tokenizer";

import { RsvpEngine } from "./rsvp-engine";

describe("subscription event types", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("distinguishes starting, resuming, advancement, navigation, and completion", () => {
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 600,
    });
    engine.load("one two three");
    const events: RsvpEventType[] = [];
    engine.subscribe((snapshot, eventType) => {
      expect(snapshot).toBe(engine.getSnapshot());
      events.push(eventType);
    });
    engine.play();
    engine.pause();
    engine.next();
    engine.previous();
    engine.seek(2);
    engine.play();
    vi.advanceTimersByTime(100);
    engine.play();
    vi.advanceTimersByTime(100);
    engine.stop();
    engine.play();
    expect(events).toEqual([
      "started",
      "paused",
      "navigated",
      "navigated",
      "navigated",
      "resumed",
      "completed",
      "started",
      "advanced",
      "stopped",
      "started",
    ]);
    engine.destroy();
  });

  it.each(["load", "loadTokens"] as const)("reports successful %s once", (method) => {
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
    });
    engine.load("old");
    const listener = vi.fn();
    engine.subscribe(listener);
    if (method === "load") {
      engine.load("new");
    } else {
      engine.loadTokens([{ value: "new", ovpIndex: 0, durationMultiplier: 1 }]);
    }
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "loaded"]]);
    engine.destroy();
  });

  it("reports effective speed and presentation changes, skipping no-ops and rejected commands", () => {
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 600,
    });
    engine.load("one two");
    const events: RsvpEventType[] = [];
    engine.subscribe((_, eventType) => events.push(eventType));
    engine.setWpm(600);
    engine.setWpm(300);
    engine.setMsPerItem(100);
    expect(() => engine.setWpm(0)).toThrow();
    engine.play();
    engine.pause();
    engine.previous();
    engine.seek(0);
    engine.next();
    engine.next();
    expect(events).toEqual(["speedChanged", "speedChanged", "started", "paused", "navigated"]);
    engine.destroy();
  });

  it("throws invalid controls without notifying subscribers or onError", () => {
    const onError = vi.fn();
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      onError,
    });
    engine.load("one");
    const initial = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.pause()).toThrow();
    expect(() => engine.seek(-1)).toThrow();
    expect(() => engine.next()).toThrow();
    expect(() => engine.previous()).toThrow();
    expect(() => engine.reset()).toThrow();
    expect(engine.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
    engine.play();
    expect(() => engine.play()).toThrow();
    expect(listener.mock.calls.map((call) => call[1])).toEqual(["started"]);
    expect(onError).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("reports timer errors through onError and publishes only the changed playback state", () => {
    let schedules = 0;
    const scheduler: SchedulerStrategy = {
      cancel: vi.fn(),
      schedule: (task, delay) => {
        if (++schedules === 2) {
          throw new Error("schedule failed");
        }
        setTimeout(task, delay);
      },
    };
    const onError = vi.fn();
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      scheduler,
      wpm: 600,
      onError,
    });
    engine.load("one two");
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.play();
    vi.advanceTimersByTime(100);
    expect(listener.mock.calls.map((call) => call[1])).toEqual(["started", "stateChanged"]);
    expect(engine.getSnapshot().state).toBe("ERROR");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(PlaybackSchedulingError);
    engine.reset();
    expect(listener).toHaveBeenLastCalledWith(engine.getSnapshot(), "reset");
    expect(() => engine.play()).toThrow("Cannot play: no tokens loaded.");
    expect(listener).toHaveBeenLastCalledWith(engine.getSnapshot(), "reset");
    engine.destroy();

    const failed = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      onError,
      scheduler: {
        cancel: vi.fn(),
        schedule: () => {
          throw new Error("start failed");
        },
      },
    });
    failed.load("one");
    const startListener = vi.fn();
    failed.subscribe(startListener);
    expect(() => failed.play()).toThrow("Failed to schedule playback.");
    expect(startListener.mock.calls).toEqual([[failed.getSnapshot(), "stateChanged"]]);
    expect(onError).toHaveBeenCalledOnce();
    failed.destroy();
  });

  it("keeps every reentrant notification paired with its snapshot, in order", () => {
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 600,
    });
    engine.load("one two");
    const first: [RsvpSnapshot<string>, RsvpEventType][] = [];
    const second: [RsvpSnapshot<string>, RsvpEventType][] = [];
    engine.subscribe((snapshot, eventType) => {
      first.push([snapshot, eventType]);
      if (eventType === "started") {
        engine.pause();
        engine.setWpm(300);
        engine.play();
      }
    });
    engine.subscribe((snapshot, eventType) => second.push([snapshot, eventType]));
    engine.play();
    expect(first.map(([snapshot, eventType]) => [snapshot.state, snapshot.wpm, eventType])).toEqual(
      [
        ["PLAYING", 600, "started"],
        ["PAUSED", 600, "paused"],
        ["PAUSED", 300, "speedChanged"],
        ["PLAYING", 300, "resumed"],
      ],
    );
    expect(second).toEqual(first);
    for (let index = 0; index < first.length; index++) {
      expect(second[index]?.[0]).toBe(first[index]?.[0]);
    }
    engine.destroy();
  });

  it("reports a resume scheduling failure without a resumed notification", () => {
    let schedules = 0;
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      scheduler: {
        cancel: vi.fn(),
        schedule: () => {
          if (++schedules === 2) {
            throw new Error("resume failed");
          }
        },
      },
    });
    engine.load("one two");
    engine.play();
    engine.pause();
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.play()).toThrow("Failed to schedule playback.");
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "stateChanged"]]);
    expect(engine.getSnapshot().state).toBe("ERROR");
    engine.destroy();
  });

  it("reports subscriber failures and delivers pending notifications in order", () => {
    const onError = vi.fn();
    const engine = new RsvpEngine({
      tokenizer: new DefaultTokenizer<string>(),
      onError,
    });
    engine.load("one");
    const failure = new Error("subscriber failed");
    const unsubscribe = engine.subscribe((_, eventType) => {
      if (eventType === "started") {
        engine.pause();
        throw failure;
      }
    });
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.play()).not.toThrow();
    expect(listener.mock.calls.map(([, eventType]) => eventType)).toEqual(["started", "paused"]);
    expect(listener.mock.calls[0]![0]).toMatchObject({ state: "PLAYING" });
    expect(listener.mock.calls[1]![0]).toBe(engine.getSnapshot());
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0]).toMatchObject({
      eventType: "started",
      cause: failure,
    });
    expect(engine.getSnapshot()).toMatchObject({ state: "PAUSED" });
    unsubscribe();
    listener.mockClear();
    engine.stop();
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "stopped"]]);
    engine.destroy();
  });

  it.each([true, false])(
    "reports nested command errors only when the listener lets them escape (caught: %s)",
    (caught) => {
      const onError = vi.fn();
      const engine = new RsvpEngine({
        tokenizer: new DefaultTokenizer<string>(),
        onError,
      });
      engine.load("one");
      let commandError: unknown;
      engine.subscribe((_, eventType) => {
        if (eventType !== "started") {
          return;
        }
        try {
          engine.setWpm(0);
        } catch (error) {
          commandError = error;
          if (!caught) {
            throw error;
          }
        }
      });
      const listener = vi.fn();
      engine.subscribe(listener);
      expect(() => engine.play()).not.toThrow();
      expect(commandError).toBeInstanceOf(InvalidInputError);
      expect(listener).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledTimes(caught ? 0 : 1);
      if (!caught) {
        expect(onError.mock.calls[0]![0]).toBeInstanceOf(ListenerError);
        expect(onError.mock.calls[0]![0].cause).toBe(commandError);
      }
      expect(engine.getSnapshot().state).toBe("PLAYING");
      engine.destroy();
    },
  );
});
