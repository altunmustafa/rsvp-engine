/**
 * Low-level time and timer abstraction for schedulers.
 * Allows injecting custom time sources and timers for testing or non-standard environments.
 */
export interface TimeDriver {
  /** Returns the current timestamp in milliseconds (high-resolution preferred). */
  now(): number;
  /** Schedules a callback after `ms` milliseconds. */
  setTimeout(callback: () => void, ms: number): unknown;
  /** Cancels a scheduled timeout. */
  clearTimeout(handle: unknown): void;
}

/**
 * Injectable strategy interface for timing and task scheduling.
 * Implementors control how tasks are scheduled with delay.
 */
export interface SchedulerStrategy {
  /** Schedules a task to run after `delayMs`, with drift correction for continuous sessions. */
  schedule(task: () => void, delayMs: number): void;
  /** Cancels any currently pending scheduled task and resets the session timeline. */
  cancel(): void;
}
