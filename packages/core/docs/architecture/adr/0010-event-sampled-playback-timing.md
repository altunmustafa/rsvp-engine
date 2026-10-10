# ADR-0010: Event-sampled playback timing

- Date: 2026-10-10

## Status

Accepted

## Context

Applications need total and remaining playback estimates that account for token duration multipliers, navigation, and speed changes. Repeatedly summing remaining tokens would add O(n) work to frequent playback updates. A Core countdown timer would add scheduling and UI responsibilities. Publishing a wall-clock completion time would couple consumers to clock synchronization.

Pause/resume already preserves the current item's remainder under [ADR-0006](./0006-pause-resume-remaining-time.md). Nominal deadlines can misrepresent that remainder when the scheduler corrects drift. The existing [typed subscription](./0009-typed-store-notifications.md) provides a place to publish timing atomically with playback state.

## Decision

We will expose a frozen `RsvpTiming` in `getSnapshot().timing` with `totalDurationMs`, nullable `remainingDurationMs`, and `sampledAtMs` from the engine's `TimeDriver`. Playback, item, loading, and effective speed changes sample timing after scheduling finishes. Reads, no-ops, and nonfatal error changes do not resample. Fatal `ERROR` invalidates remaining duration with `null`.

We will build duration-multiplier suffix sums on load in O(n) time and storage, then compute estimates in O(1). Total duration uses the selected speed for all items. Remaining duration combines the current item's retained remainder with future item durations at the selected speed. Existing speed and state restrictions remain in force.

Schedulers may expose an effective deadline through optional `getDeadline()`, using the engine's clock. The default scheduler includes drift correction; other schedulers retain nominal accounting without implementing the method. Resume of an expired item advances or completes immediately and publishes one `advanced` or `completed` notification. Existing scheduling revision guards continue to reject cancelled callbacks.

Applications own countdown timers and calendar-time conversion. A consumer that subtracts sample age must share the engine clock and apply subtraction only while playback is running.

## Consequences

Core remains dependency-free and adds neither a countdown timer nor a separate timing event. Adapters reuse the existing atomic snapshot and notification queue. Cached reads remain stable, and paused estimates do not count down.

The suffix array adds O(n) storage. Estimates exclude pauses and future host delays. Total duration describes a fresh playback, so remaining duration can exceed total duration after a speed increase that preserves the current item's older, longer period. Custom schedulers need deadline support for drift-aware accounting; nominal fallback remains compatible.
