import type { SchedulerStrategy } from "../scheduler/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IndexOutOfBoundsError, InvalidTransitionError } from "../errors";
import { DefaultTokenizer } from "../tokenizer/default-tokenizer";

import { RsvpEngine } from "./rsvp-engine";

describe("retained playback controls", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([undefined, "", "   ", "one two."])("keeps Stop inert in IDLE for input %j", (data) => {
    const engine = new RsvpEngine({ data, wpm: 600 });
    const initial = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);

    vi.advanceTimersByTime(500);
    engine.stop();
    engine.stop();

    expect(engine.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
  });

  it.each(["PLAYING", "PAUSED", "STOPPED", "COMPLETED"] as const)(
    "stops %s at the beginning without retokenizing or scheduling",
    (state) => {
      const tokenizer = new DefaultTokenizer<string>();
      const tokenize = vi.spyOn(tokenizer, "tokenize");
      const engine = new RsvpEngine({ data: "one two.", tokenizer, wpm: 600 });
      const firstItem = engine.currentItem;
      engine.play();
      vi.advanceTimersByTime(150);
      if (state === "PAUSED") {
        engine.pause();
      }
      if (state === "STOPPED") {
        engine.stop();
      }
      if (state === "COMPLETED") {
        vi.advanceTimersByTime(150);
      }
      engine.setWpm(300);
      expect(engine.state).toBe(state);
      const before = engine.getSnapshot();
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.stop();

      const stopped = engine.getSnapshot();
      expect(stopped).toMatchObject({
        state: "STOPPED",
        currentIndex: 0,
        progress: 0,
        totalItems: 2,
        timing: { totalDurationMs: 600, remainingDurationMs: 600 },
      });
      expect(stopped.currentItem).toBe(firstItem);
      expect(tokenize).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      if (state === "STOPPED") {
        expect(stopped).toBe(before);
        expect(listener).not.toHaveBeenCalled();
      } else {
        expect(listener.mock.calls).toEqual([[stopped, "stopped"]]);
      }

      listener.mockClear();
      vi.advanceTimersByTime(1000);
      engine.stop();
      expect(engine.getSnapshot()).toBe(stopped);
      expect(listener).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);

      engine.play();
      expect(engine.currentItem).toBe(firstItem);
      expect(listener).toHaveBeenLastCalledWith(engine.getSnapshot(), "started");
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(199);
      expect(engine.currentIndex).toBe(0);
      vi.advanceTimersByTime(1);
      expect(engine.currentItem?.value).toBe("two.");
      engine.destroy();
    },
  );

  it.each([0, 1])("selects initial index %i without starting playback", (index) => {
    const tokenizer = new DefaultTokenizer<string>();
    const tokenize = vi.spyOn(tokenizer, "tokenize");
    const engine = new RsvpEngine({ data: "one two.", tokenizer, wpm: 600 });
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.seek(index);

    const selected = engine.getSnapshot();
    expect(selected).toMatchObject({
      state: "PAUSED",
      currentIndex: index,
      currentItem: { value: index === 0 ? "one" : "two." },
      progress: index / 2,
      totalItems: 2,
      timing: { totalDurationMs: 300, remainingDurationMs: index === 0 ? 300 : 200 },
    });
    expect(listener.mock.calls).toEqual([[selected, "navigated"]]);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(engine.getSnapshot()).toBe(selected);
    expect(tokenize).toHaveBeenCalledOnce();

    engine.play();
    expect(engine.currentItem).toBe(selected.currentItem);
    expect(listener).toHaveBeenLastCalledWith(engine.getSnapshot(), "resumed");
    expect(vi.getTimerCount()).toBe(1);
    const duration = index === 0 ? 100 : 200;
    vi.advanceTimersByTime(duration - 1);
    expect(engine.currentIndex).toBe(index);
    expect(engine.state).toBe("PLAYING");
    vi.advanceTimersByTime(1);
    expect(engine.state).toBe(index === 0 ? "PLAYING" : "COMPLETED");
    if (index === 0) {
      expect(engine.currentIndex).toBe(1);
    }
    engine.destroy();
  });

  it.each([NaN, Infinity, 0.5, -1, 2])(
    "preserves initial selection when seek(%s) is invalid",
    (index) => {
      const engine = new RsvpEngine({ data: "one two", wpm: 600 });
      const initial = engine.getSnapshot();
      const listener = vi.fn();
      engine.subscribe(listener);

      expect(() => engine.seek(index)).toThrow(IndexOutOfBoundsError);

      const failed = engine.getSnapshot();
      expect(failed).toBe(initial);
      expect(listener).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      engine.destroy();
    },
  );

  it("rejects initial seek on empty input without creating a seekable session", () => {
    const engine = new RsvpEngine({ data: "   " });
    expect(() => engine.seek(0)).toThrow(IndexOutOfBoundsError);
    expect(engine.getSnapshot()).toMatchObject({
      state: "IDLE",
      currentIndex: 0,
      currentItem: null,
      progress: 0,
      totalItems: 0,
      timing: { totalDurationMs: 0, remainingDurationMs: 0 },
    });
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
  });

  it.each(["stop", "seek"] as const)("keeps %s unavailable in fatal ERROR", (command) => {
    const scheduler: SchedulerStrategy = {
      schedule: () => {
        throw new Error("scheduler failure");
      },
      cancel: vi.fn(),
    };
    const engine = new RsvpEngine({ data: "one two", scheduler });
    expect(() => engine.play()).toThrow("Failed to schedule playback.");
    const failed = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);

    if (command === "stop") {
      expect(() => engine.stop()).toThrow(InvalidTransitionError);
    } else {
      expect(() => engine.seek(1)).toThrow(InvalidTransitionError);
    }

    const rejected = engine.getSnapshot();
    expect(rejected).toBe(failed);
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    engine.reset();
    expect(engine.getSnapshot()).toMatchObject({ state: "IDLE", totalItems: 0 });
    engine.destroy();
  });

  it("ignores cancelled callbacks after stopping, seeking, and resuming", () => {
    const tasks: (() => void)[] = [];
    const engine = new RsvpEngine({
      data: "one two",
      scheduler: {
        schedule: (task) => tasks.push(task),
        cancel: vi.fn(),
      },
    });
    engine.play();
    tasks[0]();
    engine.stop();
    engine.seek(1);
    expect(tasks).toHaveLength(2);
    engine.play();
    const resumed = engine.getSnapshot();
    tasks[1]();
    expect(engine.getSnapshot()).toBe(resumed);
    tasks[2]();
    expect(engine.state).toBe("COMPLETED");
    engine.destroy();
  });
});
