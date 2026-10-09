import type { SchedulerStrategy, TokenizerStrategy } from "@rsvp-engine/core";

import { EngineDestroyedError, IndexOutOfBoundsError, InvalidInputError } from "@rsvp-engine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRsvpController } from "./controller";

describe("RSVP controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("returns cached immutable client and construction-time server snapshots", () => {
    const controller = createRsvpController({ data: "one two", wpm: 300 });
    const initial = controller.getSnapshot();

    expect(Object.isFrozen(initial)).toBe(true);
    expect(initial.error).toBeNull();
    expect(initial.snapshot).toMatchObject({
      state: "IDLE",
      totalItems: 2,
      progress: 0,
      wpm: 300,
    });
    expect(controller.getSnapshot()).toBe(initial);
    expect(controller.getServerSnapshot()).toBe(initial);

    controller.setWpm(600);

    expect(controller.getSnapshot()).not.toBe(initial);
    expect(controller.getServerSnapshot()).toBe(initial);
    controller.destroy();
  });

  it("notifies once for silent mutations and skips unchanged snapshots", () => {
    const controller = createRsvpController<string>();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.setWpm(600);
    controller.setWpm(600);
    controller.load("one two");
    controller.setMsPerItem(200);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(controller.getSnapshot().snapshot).toMatchObject({
      totalItems: 2,
      wpm: 300,
      msPerItem: 200,
    });
    controller.destroy();
  });

  it("preserves exact WPM and notifies only for observable changes", () => {
    const controller = createRsvpController({ wpm: 425 });
    const server = controller.getServerSnapshot();
    expect(server.snapshot.wpm).toBe(425);
    const listener = vi.fn();
    controller.subscribe(listener);
    const { setWpm } = controller;
    expect(controller).not.toHaveProperty("setSpeed");

    setWpm(225);
    const exact = controller.getSnapshot();
    expect(exact.snapshot.wpm).toBe(225);
    setWpm(225);
    expect(controller.getSnapshot()).toBe(exact);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.setMsPerItem(exact.snapshot.msPerItem);
    expect(controller.getSnapshot().snapshot.wpm).toBe(60_000 / exact.snapshot.msPerItem);
    expect(listener).toHaveBeenCalledTimes(2);
    setWpm(225);
    expect(controller.getSnapshot().snapshot.wpm).toBe(225);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(controller.getServerSnapshot()).toBe(server);
    controller.destroy();
    expect(() => setWpm(300)).toThrow(EngineDestroyedError);
  });

  it("preserves separate meaningful Core event updates without notifying for duplicates", () => {
    const controller = createRsvpController({ data: "one two", wpm: 600 });
    const observed: { state: string; progress: number }[] = [];
    controller.subscribe(() => {
      const { progress, state } = controller.getSnapshot().snapshot;
      observed.push({ state, progress });
    });

    controller.play();

    expect(observed).toEqual([
      { state: "PLAYING", progress: 0 },
      { state: "PLAYING", progress: 0.5 },
    ]);

    vi.advanceTimersByTime(100);
    expect(observed.at(-1)).toEqual({ state: "PLAYING", progress: 1 });

    vi.advanceTimersByTime(100);
    expect(observed.at(-1)).toEqual({ state: "COMPLETED", progress: 1 });
    expect(observed).toHaveLength(4);
    controller.destroy();
  });

  it("wraps playback, navigation, loading, timing, and reset operations", () => {
    const fatal = new Error("fatal tokenizer");
    const tokenizer: TokenizerStrategy<string> = {
      tokenize: vi
        .fn()
        .mockImplementationOnce(() => [
          { value: "one", ovpIndex: 0, delayMultiplier: 1 },
          { value: "two", ovpIndex: 0, delayMultiplier: 1 },
        ])
        .mockImplementationOnce(() => {
          throw fatal;
        }),
    };
    const controller = createRsvpController({ tokenizer, wpm: 300 });

    controller.load("source");
    controller.play();
    controller.pause();
    controller.next();
    expect(controller.getSnapshot().snapshot.currentIndex).toBe(1);
    controller.previous();
    expect(controller.getSnapshot().snapshot.currentIndex).toBe(0);
    controller.seek(1);
    controller.stop();
    controller.loadTokens([{ value: "replacement", ovpIndex: 0, delayMultiplier: 1 }]);
    controller.setWpm(600);
    controller.setMsPerItem(250);

    expect(controller.getSnapshot().snapshot).toMatchObject({
      state: "IDLE",
      currentItem: { value: "replacement" },
      totalItems: 1,
      msPerItem: 250,
    });

    expect(() => controller.load("fatal")).toThrow(fatal);
    expect(controller.getSnapshot()).toMatchObject({
      snapshot: { state: "ERROR" },
      error: fatal,
    });

    controller.reset();
    expect(controller.getSnapshot()).toMatchObject({
      snapshot: { state: "IDLE", totalItems: 0 },
      error: fatal,
    });
    controller.destroy();
  });

  it("keeps errors until clearError and records event-based failures", () => {
    const controller = createRsvpController<string>();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.play();
    const reported = controller.getSnapshot().error;
    expect(reported).toBeInstanceOf(InvalidInputError);

    controller.setWpm(600);
    expect(controller.getSnapshot().error).toBe(reported);

    controller.clearError();
    expect(controller.getSnapshot().error).toBeNull();
    controller.clearError();

    expect(listener).toHaveBeenCalledTimes(3);
    controller.destroy();
  });

  it("records synchronous failures and rethrows the original value", () => {
    const controller = createRsvpController<string>();

    let thrown: unknown;
    try {
      controller.setWpm(0);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidInputError);
    expect(controller.getSnapshot().error).toBe(thrown);

    const tokenizer: TokenizerStrategy<string> = {
      tokenize: () => {
        throw "string failure";
      },
    };
    const stringFailureController = createRsvpController({ tokenizer });

    expect(() => stringFailureController.load("input")).toThrow("string failure");
    expect(stringFailureController.getSnapshot().error).toMatchObject({
      message: "string failure",
    });

    controller.destroy();
    stringFailureController.destroy();
  });

  it("reports invalid navigation through the observable error channel", () => {
    const controller = createRsvpController({ data: "one two" });

    controller.next();
    expect(controller.getSnapshot().error).toMatchObject({
      message: "next() is only available in PAUSED state.",
    });
    controller.clearError();
    controller.previous();
    expect(controller.getSnapshot().error).toMatchObject({
      message: "previous() is only available in PAUSED state.",
    });
    controller.destroy();
  });

  it.for([NaN, 0.5])(
    "reports seek(%s) without corrupting the cached playback snapshot",
    (index) => {
      const controller = createRsvpController({ data: "one two three", wpm: 600 });
      controller.play();
      vi.advanceTimersByTime(140);
      controller.pause();
      const before = controller.getSnapshot();
      const listener = vi.fn();
      controller.subscribe(listener);

      expect(() => controller.seek(index)).not.toThrow();

      expect(controller.getSnapshot().snapshot).toEqual(before.snapshot);
      expect(controller.getSnapshot().error).toBeInstanceOf(IndexOutOfBoundsError);
      expect(listener).toHaveBeenCalledTimes(1);
      controller.clearError();
      controller.play();
      vi.advanceTimersByTime(59);
      expect(controller.getSnapshot().snapshot.currentIndex).toBe(1);
      vi.advanceTimersByTime(1);
      expect(controller.getSnapshot().snapshot.currentIndex).toBe(2);
      controller.destroy();
    },
  );

  it("allows safe unsubscription during notification", () => {
    const controller = createRsvpController({ data: "one two" });
    const second = vi.fn();
    const unsubscribeSecond = controller.subscribe(second);
    controller.subscribe(() => unsubscribeSecond());

    controller.setWpm(400);
    controller.setWpm(500);

    expect(second).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("keeps the final snapshot readable and rejects work after idempotent destroy", () => {
    const scheduler: SchedulerStrategy = {
      schedule: vi.fn(),
      cancel: vi.fn(),
    };
    const controller = createRsvpController({ data: "one two", scheduler });
    const unsubscribe = controller.subscribe(vi.fn());
    controller.play();
    const finalSnapshot = controller.getSnapshot();

    controller.destroy();
    controller.destroy();
    unsubscribe();

    expect(controller.getSnapshot()).toBe(finalSnapshot);
    expect(controller.getServerSnapshot()).not.toBe(finalSnapshot);
    expect(() => controller.subscribe(vi.fn())).toThrow(EngineDestroyedError);
    expect(() => controller.play()).toThrow(EngineDestroyedError);
    expect(() => controller.clearError()).toThrow(EngineDestroyedError);
    expect(scheduler.cancel).toHaveBeenCalled();
  });
});
