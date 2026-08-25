import type { TimeDriver } from "./types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DriftCorrectedScheduler } from "./drift-corrected-scheduler";

describe("DriftCorrectedScheduler", () => {
  let scheduler: DriftCorrectedScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new DriftCorrectedScheduler();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("schedules a task to run after the specified delay", () => {
    const task = vi.fn();
    scheduler.schedule(task, 100);

    vi.advanceTimersByTime(99);
    expect(task).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("cancel() prevents scheduled task from running", () => {
    const task = vi.fn();
    scheduler.schedule(task, 100);

    vi.advanceTimersByTime(50);
    scheduler.cancel();

    vi.advanceTimersByTime(100);
    expect(task).not.toHaveBeenCalled();
  });

  it("cancel() when no task is pending does not throw", () => {
    expect(() => scheduler.cancel()).not.toThrow();
  });

  it("consecutive schedule() calls cancel previously pending task", () => {
    const task1 = vi.fn();
    const task2 = vi.fn();

    scheduler.schedule(task1, 100);
    scheduler.schedule(task2, 50);

    vi.advanceTimersByTime(50);
    expect(task1).not.toHaveBeenCalled();
    expect(task2).toHaveBeenCalledTimes(1);
  });

  it("drift correction: adjusts subsequent task delays when drift accumulates", () => {
    let tickCount = 0;
    const task = (): void => {
      tickCount++;
      if (tickCount < 10) {
        scheduler.schedule(task, 100);
      }
    };

    scheduler.schedule(task, 100);
    vi.advanceTimersByTime(1000);
    expect(tickCount).toBe(10);
  });

  it("supports custom TimeDriver via Dependency Injection", () => {
    const customTimeDriver: TimeDriver = {
      now: vi.fn(() => 1000),
      setTimeout: vi.fn(() => "timeout-handle-1"),
      clearTimeout: vi.fn(),
    };

    const scheduler = new DriftCorrectedScheduler(customTimeDriver);
    const task = vi.fn();

    // 1. schedule utilizes injected driver's setTimeout
    scheduler.schedule(task, 100);
    expect(customTimeDriver.setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);

    // 2. cancel calls clearTimeout with the exact handle returned by setTimeout
    scheduler.cancel();
    expect(customTimeDriver.clearTimeout).toHaveBeenCalledWith("timeout-handle-1");
  });

  it("keeps one minute of pacing within 10ms under repeated 5ms timer lag", () => {
    let now = 0;
    let pending: (() => void) | undefined;
    let scheduledDelay = 0;
    const driver: TimeDriver = {
      clearTimeout: vi.fn(),
      now: () => now,
      setTimeout: (callback, delay) => {
        pending = callback;
        scheduledDelay = delay;
        return callback;
      },
    };
    const scheduler = new DriftCorrectedScheduler(driver);
    let ticks = 0;
    const tick = (): void => {
      ticks++;
      if (ticks < 600) {
        scheduler.schedule(tick, 100);
      }
    };

    scheduler.schedule(tick, 100);
    while (pending) {
      const callback = pending;
      pending = undefined;
      now += scheduledDelay + 5;
      callback();
    }

    expect(ticks).toBe(600);
    expect(Math.abs(now - 60_000)).toBeLessThan(10);
  });

  it("rebases after severe lag instead of scheduling unreadable zero-delay bursts", () => {
    let now = 0;
    const delays: number[] = [];
    let pending: (() => void) | undefined;
    const driver: TimeDriver = {
      clearTimeout: vi.fn(),
      now: () => now,
      setTimeout: (callback, delay) => {
        delays.push(delay);
        pending = callback;
        return callback;
      },
    };
    const scheduler = new DriftCorrectedScheduler(driver);
    const tick = (): void => scheduler.schedule(vi.fn(), 100);

    scheduler.schedule(tick, 100);
    now = 400;
    pending?.();

    expect(delays).toEqual([100, 100]);
  });

  it("rejects non-positive and non-finite delays", () => {
    expect(() => scheduler.schedule(vi.fn(), 0)).toThrow(RangeError);
    expect(() => scheduler.schedule(vi.fn(), Number.NaN)).toThrow(RangeError);
  });
});
