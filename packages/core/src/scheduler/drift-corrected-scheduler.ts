import type { SchedulerStrategy, TimeDriver } from "./types";

import { SystemTimeDriver } from "./system-time-driver";

/**
 * High-precision, drift-corrected task scheduler.
 *
 * Implements the {@link SchedulerStrategy} interface by tracking an ideal target timeline
 * (`#expectedTime`) across consecutive task executions. Any latency or jitter introduced
 * by the JavaScript event loop (timer drift) is calculated and subtracted from subsequent
 * intervals, ensuring stable WPM presentation without cumulative time slippage.
 *
 * @example
 * ```ts
 * const scheduler = new DriftCorrectedScheduler();
 *
 * // Schedule a task after 200ms
 * scheduler.schedule(() => {
 *   console.log("Tick!");
 * }, 200);
 *
 * // Cancel any pending task
 * scheduler.cancel();
 * ```
 */
export class DriftCorrectedScheduler implements SchedulerStrategy {
  readonly #timeDriver: TimeDriver;
  #timeoutHandle: unknown = null;
  #expectedTime: number | null = null;

  /**
   * Creates a new instance of `DriftCorrectedScheduler`.
   *
   * @param timeDriver - The underlying time and timer provider. Defaults to {@link SystemTimeDriver}.
   */
  constructor(timeDriver: TimeDriver = new SystemTimeDriver()) {
    this.#timeDriver = timeDriver;
  }

  /**
   * Schedules a task to execute after the given delay, compensating for accumulated drift.
   *
   * If a previous task is currently pending, it is automatically cancelled before scheduling
   * the new one. When part of an active session, the actual timeout duration is adjusted
   * by subtracting any detected execution delay (`drift = now - expectedTime`).
   *
   * @param task - The callback function to execute.
   * @param delayMs - The target delay in milliseconds.
   */
  public schedule(task: () => void, delayMs: number): void {
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      throw new RangeError("delayMs must be a positive finite number.");
    }

    if (this.#timeoutHandle !== null) {
      this.cancel();
    }

    const now = this.#timeDriver.now();
    let actualDelay = delayMs;

    if (this.#expectedTime === null) {
      this.#expectedTime = now + delayMs;
    } else {
      const drift = now - this.#expectedTime;
      if (drift >= delayMs) {
        // Large catch-up bursts make RSVP items unreadable; start a fresh timeline instead.
        this.#expectedTime = now + delayMs;
      } else {
        this.#expectedTime += delayMs;
        actualDelay = Math.max(delayMs / 2, delayMs - drift);
      }
    }

    this.#timeoutHandle = this.#timeDriver.setTimeout(() => {
      this.#timeoutHandle = null;
      task();
    }, actualDelay);
  }

  /**
   * Cancels any pending scheduled task and resets the session timeline.
   *
   * Calling this method halts the drift compensation timeline so that the next
   * call to {@link schedule} starts a fresh session without previous drift history.
   */
  public cancel(): void {
    this.#clearTimer();
    this.#expectedTime = null;
  }

  #clearTimer(): void {
    if (this.#timeoutHandle !== null) {
      this.#timeDriver.clearTimeout(this.#timeoutHandle);
      this.#timeoutHandle = null;
    }
  }
}
