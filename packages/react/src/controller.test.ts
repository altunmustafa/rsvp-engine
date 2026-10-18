import type { RsvpSnapshot, SchedulerStrategy, TokenizerStrategy } from "@rsvp-engine/core";

import { EngineDestroyedError, IndexOutOfBoundsError, InvalidInputError } from "@rsvp-engine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineError, ListenerError, TokenizationError, createRsvpController } from "./index";

describe("RSVP controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("exposes the flat Core snapshot through reads and subscription payloads", () => {
    const controller = createRsvpController({ data: "one two", wpm: 600 });
    const initial = controller.getSnapshot();
    expect(initial).toMatchObject({ state: "IDLE", totalItems: 2, progress: 0 });
    const observed: RsvpSnapshot<string>[] = [];
    controller.subscribe((snapshot) => {
      expect(snapshot).toBe(controller.getSnapshot());
      observed.push(snapshot);
    });
    controller.play();
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({ state: "PLAYING", progress: 0 });
    expect(controller.getServerSnapshot()).toBe(initial);
    expect(initial.state).toBe("IDLE");
    controller.destroy();
  });

  it("publishes sampled timing without timers, keeps no-op snapshots stable, and freezes paused time", () => {
    const controller = createRsvpController({ data: "one two.", wpm: 600 });
    const server = controller.getServerSnapshot();
    expect(server.timing.remainingDurationMs).toBe(300);
    controller.play();
    const playing = controller.getSnapshot();
    vi.advanceTimersByTime(40);
    expect(controller.getSnapshot()).toBe(playing);
    controller.setWpm(600);
    expect(controller.getSnapshot()).toBe(playing);
    controller.setWpm(300);
    expect(controller.getSnapshot().timing.remainingDurationMs).toBe(460);
    expect(vi.getTimerCount()).toBe(1);
    controller.pause();
    const paused = controller.getSnapshot();
    vi.advanceTimersByTime(1000);
    expect(controller.getSnapshot()).toBe(paused);
    expect(controller.getServerSnapshot()).toBe(server);
    controller.play();
    vi.advanceTimersByTime(60);
    expect(controller.getSnapshot().timing.remainingDurationMs).toBe(400);
    controller.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns cached immutable client and construction-time server snapshots", () => {
    const controller = createRsvpController({ data: "one two", wpm: 300 });
    const initial = controller.getSnapshot();

    expect(Object.isFrozen(initial)).toBe(true);
    expect(initial).toMatchObject({
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

  it("forwards Core event types with their snapshots", () => {
    const onError = vi.fn();
    const controller = createRsvpController({ data: "one two", wpm: 600, onError });
    const failure = new Error("listener failed");
    controller.subscribe((_, eventType) => {
      if (eventType === "started") {
        throw failure;
      }
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.play();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(ListenerError);
    expect(onError.mock.calls[0]![0]).toMatchObject({
      eventType: "started",
      cause: failure,
    });
    expect(listener).toHaveBeenLastCalledWith(controller.getSnapshot(), "started");
    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenLastCalledWith(controller.getSnapshot(), "advanced");
    controller.pause();
    controller.previous();
    expect(listener).toHaveBeenLastCalledWith(controller.getSnapshot(), "navigated");
    controller.destroy();
  });

  it("forwards detached OVP actions and notifications while preserving the server snapshot", () => {
    const controller = createRsvpController({ data: "hello world" });
    const server = controller.getServerSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);
    const { setOvpStrategy } = controller;
    setOvpStrategy({ calculate: () => 0 });
    expect(controller.getSnapshot().currentItem?.ovpIndex).toBe(0);
    expect(controller.getServerSnapshot()).toBe(server);
    expect(listener.mock.calls).toEqual([[controller.getSnapshot(), "ovpChanged"]]);
    controller.destroy();
  });

  it("selects before playback and stops completed sessions without replacing retained items", () => {
    const controller = createRsvpController({ data: "one two.", wpm: 600 });
    const server = controller.getServerSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.stop();
    expect(controller.getSnapshot()).toBe(server);
    expect(listener).not.toHaveBeenCalled();

    controller.seek(1);
    const selected = controller.getSnapshot();
    expect(selected).toMatchObject({
      state: "PAUSED",
      currentIndex: 1,
      progress: 0.5,
      timing: { totalDurationMs: 300, remainingDurationMs: 200 },
    });
    expect(listener).toHaveBeenLastCalledWith(selected, "navigated");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(500);
    expect(controller.getSnapshot()).toBe(selected);

    controller.play();
    vi.advanceTimersByTime(200);
    expect(controller.getSnapshot().state).toBe("COMPLETED");
    controller.stop();
    const stopped = controller.getSnapshot();
    expect(stopped).toMatchObject({
      state: "STOPPED",
      currentIndex: 0,
      progress: 0,
      totalItems: 2,
      timing: { totalDurationMs: 300, remainingDurationMs: 300 },
    });
    expect(stopped.currentItem).toBe(server.currentItem);
    expect(listener).toHaveBeenLastCalledWith(stopped, "stopped");
    listener.mockClear();
    vi.advanceTimersByTime(500);
    controller.stop();
    expect(controller.getSnapshot()).toBe(stopped);
    expect(controller.getServerSnapshot()).toBe(server);
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
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
    expect(controller.getSnapshot()).toMatchObject({
      totalItems: 2,
      wpm: 300,
      msPerItem: 200,
    });
    controller.destroy();
  });

  it("preserves exact WPM and notifies only for observable changes", () => {
    const controller = createRsvpController({ wpm: 425 });
    const server = controller.getServerSnapshot();
    expect(server.wpm).toBe(425);
    const listener = vi.fn();
    controller.subscribe(listener);
    const { setWpm } = controller;

    setWpm(225);
    const exact = controller.getSnapshot();
    expect(exact.wpm).toBe(225);
    setWpm(225);
    expect(controller.getSnapshot()).toBe(exact);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.setMsPerItem(exact.msPerItem);
    expect(controller.getSnapshot().wpm).toBe(60_000 / exact.msPerItem);
    expect(listener).toHaveBeenCalledTimes(2);
    setWpm(225);
    expect(controller.getSnapshot().wpm).toBe(225);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(controller.getServerSnapshot()).toBe(server);
    controller.destroy();
    expect(() => setWpm(300)).toThrow(EngineDestroyedError);
  });

  it("observes one consistent Core update per presentation and completion", () => {
    const controller = createRsvpController({ data: "one two", wpm: 600 });
    const observed: { state: string; progress: number }[] = [];
    controller.subscribe(() => {
      const { progress, state } = controller.getSnapshot();
      observed.push({ state, progress });
    });

    controller.play();

    expect(observed).toEqual([{ state: "PLAYING", progress: 0 }]);

    vi.advanceTimersByTime(100);
    expect(observed.at(-1)).toEqual({ state: "PLAYING", progress: 0.5 });

    vi.advanceTimersByTime(100);
    expect(observed.at(-1)).toEqual({ state: "COMPLETED", progress: 1 });
    expect(observed).toHaveLength(3);
    controller.destroy();
  });

  it("wraps playback, navigation, loading, timing, and reset operations", () => {
    const fatal = new Error("fatal tokenizer");
    const tokenizer: TokenizerStrategy<string> = {
      tokenize: vi
        .fn()
        .mockImplementationOnce(() => [
          { value: "one", ovpIndex: 0, durationMultiplier: 1 },
          { value: "two", ovpIndex: 0, durationMultiplier: 1 },
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
    expect(controller.getSnapshot().currentIndex).toBe(1);
    controller.previous();
    expect(controller.getSnapshot().currentIndex).toBe(0);
    controller.seek(1);
    controller.stop();
    controller.loadTokens([{ value: "replacement", ovpIndex: 0, durationMultiplier: 1 }]);
    controller.setWpm(600);
    controller.setMsPerItem(250);

    expect(controller.getSnapshot()).toMatchObject({
      state: "IDLE",
      currentItem: { value: "replacement" },
      totalItems: 1,
      msPerItem: 250,
    });

    let thrown: unknown;
    try {
      controller.load("fatal");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(EngineError);
    expect(thrown).toBeInstanceOf(TokenizationError);
    expect(thrown).toMatchObject({ isFatal: true, cause: fatal });
    expect(controller.getSnapshot()).toMatchObject({
      state: "ERROR",
    });

    controller.reset();
    expect(controller.getSnapshot()).toMatchObject({
      state: "IDLE",
      totalItems: 0,
    });
    controller.destroy();
  });

  it("forwards timer failures through onError after publishing the ERROR state", () => {
    const onError = vi.fn();
    const failure = new Error("schedule failed");
    let schedules = 0;
    const controller = createRsvpController({
      data: "one two",
      wpm: 600,
      onError,
      scheduler: {
        cancel: vi.fn(),
        schedule: (task, delay) => {
          if (++schedules === 2) {
            throw failure;
          }
          setTimeout(task, delay);
        },
      },
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.play();
    expect(onError).not.toHaveBeenCalled();
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    expect(controller.getSnapshot().state).toBe("ERROR");
    expect(listener).toHaveBeenLastCalledWith(controller.getSnapshot(), "stateChanged");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0]).toMatchObject({ isFatal: true, cause: failure });
    controller.destroy();
  });

  it("throws synchronous failures without calling onError or notifying subscribers", () => {
    const onError = vi.fn();
    const controller = createRsvpController<string>({ onError });
    const initial = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);

    let thrown: unknown;
    try {
      controller.setWpm(0);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidInputError);
    expect(controller.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    const tokenizer: TokenizerStrategy<string> = {
      tokenize: () => {
        throw "string failure";
      },
    };
    const stringFailureController = createRsvpController({ tokenizer });

    expect(() => stringFailureController.load("input")).toThrow(
      expect.objectContaining({
        message: "Failed to tokenize input.",
        cause: "string failure",
      }),
    );

    controller.destroy();
    stringFailureController.destroy();
  });

  it("throws invalid navigation errors directly", () => {
    const controller = createRsvpController({ data: "one two" });

    expect(() => controller.next()).toThrow("next() is only available in PAUSED state.");
    expect(() => controller.previous()).toThrow("previous() is only available in PAUSED state.");
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

      expect(() => controller.seek(index)).toThrow(IndexOutOfBoundsError);

      expect(controller.getSnapshot()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
      controller.play();
      vi.advanceTimersByTime(59);
      expect(controller.getSnapshot().currentIndex).toBe(1);
      vi.advanceTimersByTime(1);
      expect(controller.getSnapshot().currentIndex).toBe(2);
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

  it("rejects work after idempotent destroy and preserves previously captured snapshots", () => {
    const scheduler: SchedulerStrategy = {
      schedule: vi.fn(),
      cancel: vi.fn(),
    };
    const controller = createRsvpController({ data: "one two", scheduler });
    const unsubscribe = controller.subscribe(vi.fn());
    controller.play();
    const finalSnapshot = controller.getSnapshot();
    const serverSnapshot = controller.getServerSnapshot();

    controller.destroy();
    controller.destroy();
    unsubscribe();

    expect(finalSnapshot).toMatchObject({ state: "PLAYING", currentItem: { value: "one" } });
    expect(serverSnapshot).toMatchObject({ state: "IDLE", currentItem: { value: "one" } });
    expect(Object.isFrozen(finalSnapshot)).toBe(true);
    expect(Object.isFrozen(serverSnapshot)).toBe(true);
    expect(() => controller.subscribe(vi.fn())).toThrow(EngineDestroyedError);
    expect(() => controller.play()).toThrow(EngineDestroyedError);
    expect(scheduler.cancel).toHaveBeenCalled();
  });
});
