import type { RsvpEventType, RsvpSnapshot } from "./types";
import type { SchedulerStrategy, TimeDriver } from "../scheduler/types";

import { describe, expect, it, vi } from "vitest";

import { RsvpEngine } from "./rsvp-engine";

function createClock() {
  let now = 0;
  let id = 0;
  const tasks = new Map<number, { callback: () => void; due: number }>();
  const driver: TimeDriver = {
    now: () => now,
    setTimeout: (callback, delay) => {
      const handle = ++id;
      tasks.set(handle, { callback, due: now + delay });
      return handle;
    },
    clearTimeout: (handle) => tasks.delete(handle as number),
  };
  return {
    driver,
    pending: () => tasks.size,
    elapse: (ms: number) => {
      now += ms;
    },
    tick: (lag = 0) => {
      const [handle, task] = [...tasks].sort((left, right) => left[1].due - right[1].due)[0]!;
      tasks.delete(handle);
      now = Math.max(now, task.due) + lag;
      task.callback();
    },
  };
}

describe("playback timing", () => {
  it("samples weighted durations on changes without polling or additional timers", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one, two.", wpm: 600, timeDriver: clock.driver });
    const initial = engine.getSnapshot().timing;
    expect(initial).toEqual({ totalDurationMs: 350, remainingDurationMs: 350, sampledAtMs: 0 });
    expect(Object.isFrozen(initial)).toBe(true);
    expect(clock.pending()).toBe(0);
    engine.play();
    clock.elapse(50);
    expect(engine.getSnapshot().timing).toBe(initial);
    expect(clock.pending()).toBe(1);
    engine.pause();
    expect(engine.getSnapshot().timing).toEqual({
      totalDurationMs: 350,
      remainingDurationMs: 300,
      sampledAtMs: 50,
    });
    clock.elapse(500);
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(300);
    engine.setWpm(300);
    expect(engine.getSnapshot().timing).toEqual({
      totalDurationMs: 700,
      remainingDurationMs: 500,
      sampledAtMs: 550,
    });
    engine.play();
    clock.tick();
    expect(engine.progress).toBe(1);
    expect(engine.state).toBe("PLAYING");
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(400);
    clock.tick();
    expect(engine.state).toBe("COMPLETED");
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(0);
    expect(clock.pending()).toBe(0);
    engine.play();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(700);
    engine.stop();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(700);
    engine.destroy();
    expect(clock.pending()).toBe(0);
  });

  it("recalculates navigation and replacement data without presenting or scheduling", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two three.", wpm: 600, timeDriver: clock.driver });
    engine.play();
    engine.pause();
    engine.seek(2);
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(200);
    engine.previous();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(300);
    engine.next();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(200);
    engine.seek(0);
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(400);
    const timing = engine.getSnapshot().timing;
    engine.seek(Number.NaN);
    expect(engine.getSnapshot().timing).toBe(timing);
    engine.loadTokens([{ value: "new", ovpIndex: 0, durationMultiplier: 3 }]);
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(300);
    engine.load("");
    expect(engine.getSnapshot().timing).toMatchObject({
      totalDurationMs: 0,
      remainingDurationMs: 0,
    });
    expect(clock.pending()).toBe(0);
    engine.destroy();
  });

  it("preserves the playing item while changing future durations and skips unchanged speed", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two.", wpm: 600, timeDriver: clock.driver });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.play();
    clock.elapse(40);
    engine.setMsPerItem(200);
    expect(engine.getSnapshot().timing).toEqual({
      totalDurationMs: 600,
      remainingDurationMs: 460,
      sampledAtMs: 40,
    });
    const timing = engine.getSnapshot().timing;
    const notifications = listener.mock.calls.length;
    clock.elapse(10);
    engine.setMsPerItem(200);
    expect(engine.getSnapshot().timing).toBe(timing);
    expect(listener).toHaveBeenCalledTimes(notifications);
    expect(clock.pending()).toBe(1);
    engine.destroy();
  });

  it("uses the scheduler's effective deadline after drift correction", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two three", wpm: 300, timeDriver: clock.driver });
    engine.play();
    clock.tick(5);
    expect(engine.getSnapshot().timing).toEqual({
      totalDurationMs: 600,
      remainingDurationMs: 395,
      sampledAtMs: 205,
    });
    clock.elapse(95);
    engine.pause();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(300);
    clock.elapse(700);
    engine.play();
    clock.tick();
    expect(clock.driver.now()).toBe(1100);
    expect(engine.currentIndex).toBe(2);
    engine.destroy();
  });

  it("advances an expired item on resume without scheduling a zero delay", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two", wpm: 600, timeDriver: clock.driver });
    engine.play();
    clock.elapse(150);
    engine.pause();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(100);
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.play();
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "advanced"]]);
    expect(engine.state).toBe("PLAYING");
    expect(engine.currentIndex).toBe(1);
    expect(clock.pending()).toBe(1);
    clock.elapse(100);
    engine.pause();
    listener.mockClear();
    engine.play();
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "completed"]]);
    expect(engine.state).toBe("COMPLETED");
    expect(clock.pending()).toBe(0);
    engine.destroy();
  });

  it("keeps timing and snapshots stable for no-ops and nonfatal errors", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two", wpm: 600, timeDriver: clock.driver });
    engine.play();
    const playing = engine.getSnapshot();
    clock.elapse(30);
    engine.setWpm(600);
    engine.setMsPerItem(100);
    engine.clearError();
    expect(engine.getSnapshot()).toBe(playing);
    engine.seek(-1);
    expect(engine.getSnapshot().timing).toBe(playing.timing);
    engine.clearError();
    expect(engine.getSnapshot().timing).toBe(playing.timing);
    expect(clock.pending()).toBe(1);
    engine.destroy();
  });

  it("publishes timing-only changes when seeking to the same partially presented item", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two", wpm: 600, timeDriver: clock.driver });
    engine.play();
    clock.elapse(40);
    engine.pause();
    const paused = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.seek(0);
    expect(engine.getSnapshot().currentItem).toBe(paused.currentItem);
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(200);
    expect(paused.timing.remainingDurationMs).toBe(160);
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "navigated"]]);
    const selected = engine.getSnapshot();
    clock.elapse(25);
    engine.seek(0);
    engine.previous();
    expect(engine.getSnapshot()).toBe(selected);
    expect(listener).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it("delivers one atomic timing sample per nested operation, paired with its event", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two three", wpm: 600, timeDriver: clock.driver });
    const observed: [RsvpSnapshot<string>, RsvpEventType][] = [];
    engine.subscribe((_, eventType) => {
      if (eventType === "started") {
        clock.elapse(25);
        engine.pause();
        engine.setWpm(300);
      }
    });
    engine.subscribe((snapshot, eventType) => observed.push([snapshot, eventType]));
    engine.play();
    expect(
      observed.map(([snapshot, eventType]) => [
        eventType,
        snapshot.state,
        snapshot.timing.remainingDurationMs,
        snapshot.timing.sampledAtMs,
      ]),
    ).toEqual([
      ["started", "PLAYING", 300, 0],
      ["paused", "PAUSED", 275, 25],
      ["speedChanged", "PAUSED", 475, 25],
    ]);
    expect(observed[0]?.[0].timing.remainingDurationMs).toBe(300);
    expect(engine.getSnapshot()).toBe(observed[2]?.[0]);
    expect(clock.pending()).toBe(0);
    engine.destroy();
  });

  it("keeps legacy schedulers usable and ignores cancelled callbacks after resume", () => {
    const clock = createClock();
    const callbacks: (() => void)[] = [];
    const scheduler: SchedulerStrategy = {
      schedule: (task) => {
        callbacks.push(task);
      },
      cancel: vi.fn(),
    };
    const engine = new RsvpEngine({
      data: "one two",
      wpm: 600,
      timeDriver: clock.driver,
      scheduler,
    });
    engine.play();
    clock.elapse(30);
    engine.pause();
    callbacks[0]!();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(170);
    engine.play();
    callbacks[0]!();
    expect(engine.currentIndex).toBe(0);
    callbacks[1]!();
    expect(engine.currentIndex).toBe(1);
    engine.destroy();
  });

  it("invalidates remaining duration on fatal errors and clears timing on reset", () => {
    const engine = new RsvpEngine({
      data: "one",
      scheduler: {
        schedule: () => {
          throw new Error("failed");
        },
        cancel: vi.fn(),
      },
    });
    engine.play();
    expect(engine.state).toBe("ERROR");
    expect(engine.getSnapshot().timing.remainingDurationMs).toBeNull();
    engine.reset();
    expect(engine.getSnapshot().timing).toMatchObject({
      totalDurationMs: 0,
      remainingDurationMs: 0,
    });
    engine.destroy();
  });

  it("does not restart scheduling after an item listener destroys the engine", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two", timeDriver: clock.driver });
    engine.subscribe(() => engine.destroy());
    engine.play();
    expect(clock.pending()).toBe(0);
  });

  it("rejects an invalid scheduler deadline as a fatal timing failure", () => {
    const engine = new RsvpEngine({
      data: "one",
      scheduler: { schedule: vi.fn(), cancel: vi.fn(), getDeadline: () => Number.NaN },
    });
    engine.play();
    expect(engine.state).toBe("ERROR");
    expect(engine.getSnapshot().timing.remainingDurationMs).toBeNull();
    engine.destroy();
  });

  it("keeps the full remaining interval when a presentation listener pauses immediately", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one. two", wpm: 600, timeDriver: clock.driver });
    const unsubscribe = engine.subscribe((_, eventType) => {
      if (eventType === "started" || eventType === "advanced") {
        engine.pause();
      }
    });
    engine.play();
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(300);
    expect(clock.pending()).toBe(0);
    unsubscribe();
    engine.play();
    clock.tick();
    expect(clock.driver.now()).toBe(200);
    expect(engine.getSnapshot().timing.remainingDurationMs).toBe(100);
    engine.destroy();
  });

  it("preserves readable pacing and finite timing after severe lag", () => {
    const clock = createClock();
    const engine = new RsvpEngine({ data: "one two three", wpm: 600, timeDriver: clock.driver });
    engine.play();
    clock.tick(500);
    expect(engine.getSnapshot().timing).toEqual({
      totalDurationMs: 300,
      remainingDurationMs: 200,
      sampledAtMs: 600,
    });
    clock.tick();
    expect(clock.driver.now()).toBe(700);
    engine.destroy();
  });
});
