import type { RsvpEventType, RsvpSnapshot } from "./types";
import type { SchedulerStrategy } from "../scheduler/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RsvpEngine } from "./rsvp-engine";

describe("subscription event types", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("distinguishes starting, resuming, advancement, navigation, and completion", () => {
    const engine = new RsvpEngine({ data: "one two three", wpm: 600 });
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

  it.each(["load", "loadTokens"] as const)(
    "reports successful %s once, including error clearing",
    (method) => {
      const engine = new RsvpEngine({ data: "old" });
      engine.pause();
      const listener = vi.fn();
      engine.subscribe(listener);
      if (method === "load") {
        engine.load("new");
      } else {
        engine.loadTokens([{ value: "new", ovpIndex: 0, delayMultiplier: 1 }]);
      }
      expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "loaded"]]);
      expect(engine.getSnapshot().error).toBeNull();
      engine.destroy();
    },
  );

  it("reports speed and explicit error clearing, skipping no-ops", () => {
    const engine = new RsvpEngine({ data: "one two", wpm: 600 });
    const events: RsvpEventType[] = [];
    engine.subscribe((_, eventType) => events.push(eventType));
    engine.setWpm(600);
    engine.clearError();
    engine.setWpm(300);
    engine.setMsPerItem(100);
    expect(() => engine.setWpm(0)).toThrow();
    engine.clearError();
    engine.clearError();
    engine.play();
    engine.pause();
    engine.previous();
    engine.seek(0);
    engine.next();
    engine.next();
    expect(events).toEqual([
      "speedChanged",
      "speedChanged",
      "errorOccurred",
      "errorCleared",
      "started",
      "paused",
      "navigated",
    ]);
    engine.destroy();
  });

  it("reports invalid controls as errors instead of successful events", () => {
    const engine = new RsvpEngine({ data: "one" });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.pause();
    engine.stop();
    engine.seek(-1);
    engine.next();
    engine.previous();
    engine.reset();
    engine.play();
    engine.play();
    expect(listener.mock.calls.map((call) => call[1])).toEqual([
      "errorOccurred",
      "errorOccurred",
      "errorOccurred",
      "errorOccurred",
      "errorOccurred",
      "errorOccurred",
      "started",
      "errorOccurred",
    ]);
    engine.destroy();
  });

  it("replaces start and advancement events with fatal scheduling errors", () => {
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
    const engine = new RsvpEngine({ data: "one two", scheduler, wpm: 600 });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.play();
    vi.advanceTimersByTime(100);
    expect(listener.mock.calls.map((call) => call[1])).toEqual(["started", "errorOccurred"]);
    expect(engine.getSnapshot().state).toBe("ERROR");
    engine.reset();
    expect(listener).toHaveBeenLastCalledWith(engine.getSnapshot(), "reset");
    expect(engine.getSnapshot().error).toBeNull();
    engine.play();
    expect(listener).toHaveBeenLastCalledWith(engine.getSnapshot(), "errorOccurred");
    engine.destroy();

    const failed = new RsvpEngine({
      data: "one",
      scheduler: {
        cancel: vi.fn(),
        schedule: () => {
          throw new Error("start failed");
        },
      },
    });
    const startListener = vi.fn();
    failed.subscribe(startListener);
    failed.play();
    expect(startListener.mock.calls).toEqual([[failed.getSnapshot(), "errorOccurred"]]);
    failed.destroy();
  });

  it("keeps every reentrant notification paired with its snapshot, in order", () => {
    const engine = new RsvpEngine({ data: "one two", wpm: 600 });
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
      data: "one two",
      scheduler: {
        cancel: vi.fn(),
        schedule: () => {
          if (++schedules === 2) {
            throw new Error("resume failed");
          }
        },
      },
    });
    engine.play();
    engine.pause();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.play();
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "errorOccurred"]]);
    expect(engine.getSnapshot().state).toBe("ERROR");
    engine.destroy();
  });

  it("drops queued notifications on destroy or a throwing subscriber", () => {
    const engine = new RsvpEngine({ data: "one" });
    const failure = new Error("subscriber failed");
    const unsubscribe = engine.subscribe(() => {
      engine.pause();
      throw failure;
    });
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.play()).toThrow(failure);
    expect(listener).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toMatchObject({ state: "PAUSED", error: null });
    unsubscribe();
    engine.stop();
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "stopped"]]);
    engine.destroy();

    const destroyed = new RsvpEngine({ data: "one" });
    destroyed.subscribe(() => {
      destroyed.pause();
      destroyed.destroy();
    });
    const afterDestroy = vi.fn();
    destroyed.subscribe(afterDestroy);
    destroyed.play();
    expect(afterDestroy).not.toHaveBeenCalled();
  });
});
