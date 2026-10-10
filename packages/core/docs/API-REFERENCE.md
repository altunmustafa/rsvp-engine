# API Reference: `@rsvp-engine/core`

## `RsvpEngine<T = string>`

```typescript
new RsvpEngine<T>(options?: RsvpEngineOptions<T>)
```

### Options

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `data` | `T \| T[]` | none | Synchronously tokenized initial data. |
| `wpm` | `number` | `300` | Items per minute, from `1` through `6000`. |
| `msPerItem` | `number` | derived | Direct base duration; takes precedence over `wpm`. |
| `tokenizer` | `TokenizerStrategy<T>` | `DefaultTokenizer` | Synchronous tokenization strategy. |
| `scheduler` | `SchedulerStrategy` | `DriftCorrectedScheduler` | Timer scheduling strategy. |
| `timeDriver` | `TimeDriver` | `SystemTimeDriver` | Clock used by scheduling and pause/resume accounting. |

Constructor tokenization failures are thrown so they cannot be lost before subscribers are attached.

### Playback methods

| Method                  | Effect                                                                           |
| ----------------------- | -------------------------------------------------------------------------------- |
| `play()`                | Starts or resumes playback. A fresh session presents its first item immediately. |
| `pause()`               | Cancels the timer and preserves the current item and remaining display time.     |
| `stop()`                | Stops only in `PLAYING` or `PAUSED`; resets index and progress, retaining data.  |
| `seek(index)`           | Selects an item and enters `PAUSED`; valid from paused or terminal states.       |
| `next()` / `previous()` | Navigates while paused.                                                          |
| `reset()`               | Recovers a fatal `ERROR` state to empty `IDLE`.                                  |
| `destroy()`             | Idempotently cancels timers and removes listeners.                               |

Invalid control commands record an observable `error` and preserve the current state. They do not turn a usable session into a terminal error.

`seek(index)` requires a finite integer in `[0, totalItems)` and a state of `PAUSED`, `STOPPED`, or `COMPLETED`. Invalid indices record `IndexOutOfBoundsError` before checking state and preserve selection, progress, and scheduling. Empty input has no valid seek index.

### Data and speed methods

- `load(data)` synchronously invokes the configured tokenizer.
- `loadTokens(tokens)` accepts externally prepared tokens, including results produced asynchronously outside the engine.
- Loading is rejected while `PLAYING` or `ERROR`.
- `setWpm(wpm)` and `setMsPerItem(ms)` affect subsequently scheduled display periods. They do not replace a running timer or a paused item's remaining duration.

The last speed input is preserved exactly as a JavaScript `number` in its supplied unit; the other unit is derived using `60_000 / value`. This applies to constructor options, getters, and snapshots, including fractional inputs. Constructor `msPerItem` takes precedence over `wpm` when both are supplied.

```typescript
engine.setWpm(225);
engine.wpm; // 225
engine.getSnapshot().wpm; // 225
engine.msPerItem; // 266.6666666666667

engine.setMsPerItem(engine.msPerItem);
engine.wpm; // 224.99999999999997: now derived from the explicit interval
```

Derived values retain normal floating-point precision without additional rounding. Strict equality between WPM and `60_000 / msPerItem` is not guaranteed after setting WPM. A snapshot does not record the source unit and is not a lossless speed-restoration format: passing both snapshot fields back as constructor options selects `msPerItem`.

Tokens require a non-negative integer `ovpIndex` (within string bounds for string values) and a positive finite `durationMultiplier`.

`durationMultiplier` scales `msPerItem` to produce the item's display duration. `Token` and `RsvpItem` use the same field. See [multiplier migration](../README.md#migrating-duration-multipliers) for the removed token and tokenizer option names.

### State getters

- `state`, `currentIndex`, `currentItem`, `progress`, `totalItems`, `wpm`, `msPerItem` are available.
- `currentIndex/currentItem` identify the selected or visibly presented item, never an internal next-item pointer.
- Progress is `0` before presentation and reaches `1` on the final item.

### Duration estimates

`getSnapshot().timing` returns a cached, frozen `RsvpTiming` sample. It travels in the existing subscription snapshot; reading it neither recalculates durations nor starts a countdown timer.

| Field                 | Meaning                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `totalDurationMs`     | Full content duration at the current base speed, including token duration multipliers.    |
| `remainingDurationMs` | Current item's retained display time plus future item durations; `null` in fatal `ERROR`. |
| `sampledAtMs`         | Sample timestamp from the engine's `TimeDriver`, not necessarily Unix time.               |

Samples update after loading, playback state or item changes, and effective speed changes, once scheduling has finished. No-op commands and nonfatal error changes retain the previous sample. Seeking to the same paused item restores its full display period and notifies if that changes its retained duration.

Before playback and after stop, remaining duration equals total duration. Empty content has zero duration. Pause freezes the current remainder; resume preserves it. Navigation starts the selected item's full period. Completion sets remaining duration to zero; progress reaching `1` still leaves the final item's display period to run.

Speed changes update future item estimates without replacing the current item's running or paused remainder. Consequently, remaining duration can exceed total duration after a speed increase. Estimates exclude pauses and future host delays; total duration is an estimate for a fresh playback, not elapsed time plus remaining time.

Loading builds duration-multiplier suffix sums in O(n) time and storage. Subsequent duration calculations, including speed changes and item advancement, are O(1).

An application may display a countdown by sharing the engine's `TimeDriver` and subtracting `now() - sampledAtMs` from the sample only while `PLAYING`, clamping the result to zero. Rebase on each new sample and freeze the display while paused. Use engine state to detect completion. Calendar-time conversion and countdown refreshes belong to the application.

### Observable store

`getSnapshot(): RsvpSnapshot<T>` returns one immutable snapshot containing the playback fields listed above, `timing: RsvpTiming`, and `error: Error | null`. Core owns the cached value so every adapter reads the same playback and error state.

```typescript
const unsubscribe = engine.subscribe((snapshot, eventType) => {
  render(snapshot, eventType);
});
```

- `subscribe(listener: RsvpStoreListener<T>): UnsubscribeFn` calls `listener(snapshot, eventType)` with the immutable snapshot for that update and its `RsvpEventType`. It does not immediately invoke the listener; use `getSnapshot()` for the initial state. The event type is notification metadata and is not stored in the snapshot.
- Commands and scheduled advancements publish synchronously after their updates and scheduling finish. Starting playback publishes the first item together with `PLAYING`; fatal scheduling failures publish `ERROR` together with the error.
- Reads, unchanged speed values, already-cleared errors, and navigation beyond an endpoint do not notify. The cached reference stays stable until observable fields change.
- Any observable change, including an error change, creates a new snapshot. Unchanged items and errors retain their references. Snapshots and item objects are frozen; application-owned generic `value` objects are not deeply frozen.
- A callback may issue another command. Core updates `getSnapshot()` immediately, finishes delivering the current notification, and then delivers every nested update in order with its original snapshot and type. A callback's snapshot can therefore precede the latest `getSnapshot()` value. Use its supplied snapshot when handling its event.
- Unsubscribe is idempotent. `destroy()` removes subscriptions and cancels playback; the last snapshot remains readable, while commands and new subscriptions throw `EngineDestroyedError`.
- Subscription callbacks must handle their own exceptions. A thrown callback interrupts notification, discards pending notifications, and propagates to its caller; it is not recorded as an engine error. If the command also failed, its original exception takes precedence.

### Notification types

Each observable update produces one notification with one type. Types describe operations, not individual changed fields.

| `RsvpEventType` | Operation                                                                       |
| --------------- | ------------------------------------------------------------------------------- |
| `loaded`        | Successful `load()` or `loadTokens()`.                                          |
| `started`       | Initial playback, or replay from `STOPPED` or `COMPLETED`.                      |
| `resumed`       | Playback continues from `PAUSED` with a positive current-item remainder.        |
| `paused`        | Successful pause.                                                               |
| `stopped`       | Successful stop, resetting position and progress while retaining content.       |
| `advanced`      | Playback advances to the next item, including resume of an expired item.        |
| `navigated`     | `seek()`, `next()`, or `previous()` changes the observable selection or state.  |
| `completed`     | The final item's display period ends.                                           |
| `speedChanged`  | `setWpm()` or `setMsPerItem()` changes observable speed.                        |
| `reset`         | Successful recovery from `ERROR` to empty `IDLE`.                               |
| `errorOccurred` | A command or runtime operation fails, including non-throwing validation errors. |
| `errorCleared`  | `clearError()` clears an existing error.                                        |

Failed operations publish `errorOccurred` instead of their success type. Successful load/reset publish only `loaded`/`reset`, even when they also clear an error. No observable change means no notification. Destroy stops delivery and removes subscriptions without publishing an event.

### Errors

Core stores the last error, with no history array. `clearError()`, successful `load/loadTokens()`, and successful `reset()` clear it. Other successful commands retain it. Clearing the error does not change playback state; only `reset()` recovers `ERROR`.

Invalid controls record errors without throwing or changing usable playback. Invalid speed/loading input is recorded and rethrown. Unexpected tokenizer and scheduler failures enter `ERROR`; explicit tokenizer failures are also rethrown with their original value. Constructor failures throw because no instance can yet be subscribed to.

`on()`, `snapshot()`, `EventEmitter`, and the legacy event/payload types are removed. See [subscription migration](../README.md#migrating-subscriptions) for the replacement contract.

## Tokenization

`DefaultTokenizer` uses `Intl.Segmenter` for word boundaries when the runtime provides it and falls back to whitespace segmentation. `DefaultOvpStrategy` produces grapheme-aware JavaScript string offsets so consumers can safely use `slice()`.

Supported options are `sentenceDurationMultiplier`, `clauseDurationMultiplier`, `dashDurationMultiplier`, `nestedTokenize`, and `ovpStrategy`. Duration multipliers must be positive and finite. Custom OVP strategies implement `OvpStrategy` and can be injected without replacing the tokenizer:

```typescript
class LastCharacterOvpStrategy implements OvpStrategy {
  calculate(text: string): number {
    return Math.max(0, text.length - 1);
  }
}

const tokenizer = new DefaultTokenizer({
  ovpStrategy: new LastCharacterOvpStrategy(),
});
```

## Scheduling

`DriftCorrectedScheduler.schedule(task, delayMs)` accepts positive finite delays. Ordinary timer lag is deducted from the next interval. Lag of at least one full interval rebases the timeline instead of emitting zero-delay catch-up bursts. `cancel()` clears the pending task and timeline.

Schedulers may implement `getDeadline(): number | null` to expose the pending task's effective deadline in the engine's `TimeDriver` clock. The default scheduler includes drift correction and returns `null` after cancellation or task execution. Core rejects non-finite deadlines as fatal failures. Schedulers that omit the method or return `null` use nominal deadline accounting.

Pause preserves the effective deadline's remainder. If that remainder is already zero, resume advances immediately or completes the final item without scheduling a zero delay. It publishes one `advanced` or `completed` update instead of `resumed`.

`SystemTimeDriver` prefers the host's monotonic `performance.now()` clock and falls back to ECMAScript's `Date.now()`. The default driver requires host-provided `setTimeout` and `clearTimeout` functions and fails fast when they are absent. Timerless environments can provide their own `TimeDriver` through dependency injection.

See [Architecture](./architecture/README.md) and [State Machine](./STATE-MACHINE.md).
