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
| `ovpStrategy` | `OvpStrategy` | none | Per-selected-string presentation override for `load()` sessions. |
| `scheduler` | `SchedulerStrategy` | `DriftCorrectedScheduler` | Timer scheduling strategy. |
| `timeDriver` | `TimeDriver` | `SystemTimeDriver` | Clock used by scheduling and pause/resume accounting. |
| `onError` | `(error: EngineError \| ListenerError) => void` | asynchronous host reporting | Handles timer and listener failures; command failures are thrown. |

Constructor tokenization failures are thrown so they cannot be lost before subscribers are attached.

### Playback methods

| Method | Effect |
| --- | --- |
| `play()` | Starts or resumes playback. A fresh session presents its first item immediately. |
| `pause()` | Cancels the timer and preserves the current item and remaining display time. |
| `stop()` | Returns `PLAYING`, `PAUSED`, or `COMPLETED` to the beginning; no-op in `IDLE`/`STOPPED`. |
| `seek(index)` | Selects an item without playback and enters `PAUSED` from `IDLE`, `PAUSED`, `STOPPED`, or `COMPLETED`. |
| `next()` / `previous()` | Navigates while paused. |
| `reset()` | Recovers a fatal `ERROR` state to empty `IDLE`. |
| `destroy()` | Permanently cancels timers, clears session buffers and listeners, and rejects commands and new subscriptions. Safe to repeat. |

Invalid control commands throw while preserving the cached playback state without notifying subscribers or calling `onError`. They do not turn a usable session into a terminal error.

`stop()` retains loaded items without retokenizing. From `PLAYING`, `PAUSED`, or `COMPLETED`, it enters `STOPPED` with index and progress zero and remaining duration equal to total duration. Repeated calls and calls in `IDLE`, including empty input, preserve the cached snapshot and timing without notifying. Stop is invalid in fatal `ERROR`; use `reset()` to recover. See the [Stop state matrix](./STATE-MACHINE.md#stop-behavior).

`seek(index)` requires a finite integer in `[0, totalItems)` and a state of `IDLE`, `PAUSED`, `STOPPED`, or `COMPLETED`. It enters `PAUSED` without scheduling playback, giving the selected item a full display period. `play()` continues from that position. Invalid indices throw `IndexOutOfBoundsError` before checking state and preserve selection, progress, and scheduling. Empty input has no valid seek index. Pause active playback explicitly before seeking.

### Data and speed methods

- `load(data)` synchronously invokes the configured tokenizer.
- `loadTokens(tokens)` accepts externally prepared tokens, including results produced asynchronously outside the engine.
- Loading is rejected while `PLAYING` or `ERROR`.
- `setWpm(wpm)` and `setMsPerItem(ms)` affect subsequently scheduled display periods. They do not replace a running timer or a paused item's remaining duration.
- `setOvpStrategy(strategy)` sets the presentation override; `undefined` restores original token offsets. See [runtime OVP preferences](#runtime-ovp-preferences).

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
- Progress is `currentIndex / totalItems`, or `0` for empty input, until `COMPLETED` sets it to `1`. The selected item is excluded, including after seek. This measures playback position rather than reading history or elapsed time. Fatal playback or navigation errors retain the last published progress; fatal loading failures clear the session and set progress to `0`.

### Duration estimates

`getSnapshot().timing` returns a cached, frozen `RsvpTiming` sample. It travels in the existing subscription snapshot; reading it neither recalculates durations nor starts a countdown timer.

| Field                 | Meaning                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `totalDurationMs`     | Full content duration at the current base speed, including token duration multipliers.    |
| `remainingDurationMs` | Current item's retained display time plus future item durations; `null` in fatal `ERROR`. |
| `sampledAtMs`         | Sample timestamp from the engine's `TimeDriver`, not necessarily Unix time.               |

Samples update after loading, playback state or item selection changes, and effective speed changes, once scheduling has finished. OVP-only changes, no-op commands, and rejected nonfatal commands retain the previous sample. Seeking to the same paused item restores its full display period and notifies if that changes its retained duration.

In `IDLE` and `STOPPED`, remaining duration equals total duration. Empty content has zero duration. Pause freezes the current remainder; resume preserves it. Navigation, including initial seek, gives the selected item its full period. Completion sets remaining duration to zero and progress to `1` after the final item's display period ends.

Speed changes update future item estimates without replacing the current item's running or paused remainder. Consequently, remaining duration can exceed total duration after a speed increase. Estimates exclude pauses and future host delays; total duration is an estimate for a fresh playback, not elapsed time plus remaining time.

Loading builds duration-multiplier suffix sums in O(n) time and storage. Subsequent duration calculations, including speed changes and item advancement, are O(1).

An application may display a countdown by sharing the engine's `TimeDriver` and subtracting `now() - sampledAtMs` from the sample only while `PLAYING`, clamping the result to zero. Rebase on each new sample and freeze the display while paused. Use engine state to detect completion. Calendar-time conversion and countdown refreshes belong to the application.

### Observable store

`getSnapshot(): RsvpSnapshot<T>` returns one immutable snapshot containing the playback fields listed above and `timing: RsvpTiming`. Core owns the cached value so every adapter reads the same playback state. Error details are not stored in snapshots.

```typescript
const unsubscribe = engine.subscribe((snapshot, eventType) => {
  render(snapshot, eventType);
});
```

- `subscribe(listener: RsvpStoreListener<T>): UnsubscribeFn` calls `listener(snapshot, eventType)` with the immutable snapshot for that update and its `RsvpEventType`. It does not immediately invoke the listener; use `getSnapshot()` for the initial state. The event type is notification metadata and is not stored in the snapshot.
- Commands and scheduled advancements publish synchronously after their updates and scheduling finish. Starting playback publishes the first item together with `PLAYING`; fatal scheduling failures publish the changed `ERROR` state as `stateChanged`.
- Reads, unchanged speed values, rejected nonfatal commands, and navigation beyond an endpoint do not notify. The cached reference stays stable until observable fields change.
- Any observable playback change creates a new snapshot. Unchanged items retain their references. Snapshots and item objects are frozen; application-owned generic `value` objects are not deeply frozen.
- A callback may issue another command. Core updates `getSnapshot()` immediately, finishes delivering the current notification, and then delivers every nested update in order with its original snapshot and type. A callback's snapshot can therefore precede the latest `getSnapshot()` value. Use its supplied snapshot when handling its event.
- Unsubscribe is idempotent, including after destruction. `destroy()` cancels playback and clears token buffers, presentation, listeners, and pending notifications without notifying. The last snapshot remains stored internally. Commands and new subscriptions then throw `EngineDestroyedError`; callers must stop all reads. Post-destroy getter and snapshot reads are unsupported, unguarded, and have no guaranteed results. Repeated destroy is safe, and previously captured snapshots remain unchanged.
- Synchronous listener exceptions are isolated and reported through `onError` or asynchronous host reporting. Other listeners and queued updates continue, while destruction still stops delivery immediately. Listener failures do not replace an engine command's original exception.

### Notification types

Each observable update produces one notification with one type. Types describe operations, not individual changed fields.

| `RsvpEventType` | Operation                                                                         |
| --------------- | --------------------------------------------------------------------------------- |
| `loaded`        | Successful `load()` or `loadTokens()`.                                            |
| `started`       | Initial playback, or replay from `STOPPED` or `COMPLETED`.                        |
| `resumed`       | Playback continues from `PAUSED` with a positive current-item remainder.          |
| `paused`        | Successful pause.                                                                 |
| `stopped`       | Successful stop, resetting position and progress while retaining content.         |
| `advanced`      | Playback advances to the next item, including resume of an expired item.          |
| `navigated`     | `seek()`, `next()`, or `previous()` changes the observable selection or state.    |
| `completed`     | The final item's display period ends.                                             |
| `speedChanged`  | `setWpm()` or `setMsPerItem()` changes observable speed.                          |
| `ovpChanged`    | `setOvpStrategy()` changes the selected item's viewing position.                  |
| `reset`         | Successful recovery from `ERROR` to empty `IDLE`.                                 |
| `stateChanged`  | A failed operation changes observable playback state, including entering `ERROR`. |

Failed operations publish `stateChanged` only if playback state changes. Rejected nonfatal commands do not notify. Successful load/reset publish `loaded`/`reset`. No observable change means no notification. Destroy stops delivery and removes subscriptions without publishing an event.

### Errors

Core retains no error details; applications own display messages, history, and clearing. Synchronous command failures throw a normalized `EngineError` without calling `onError`; constructor and destruction failures also throw. Timer failures use `onError(error: EngineError | ListenerError)`. Nonfatal failures preserve usable playback without notifying; fatal failures cancel advancement and publish the changed `ERROR` state before error delivery.

Each synchronous subscriber failure becomes a separate `ListenerError extends Error` and goes to the same `onError` callback. Its constructor is `new ListenerError(eventType: RsvpEventType, options?: ErrorOptionsWithMessage)`, with readonly `eventType`, original `cause`, and an event-based default message. It has no `isFatal` and cannot inherit engine fatality or change playback state. Delivery continues with other listeners and queued notifications. A listener may issue commands or destroy the engine; their explicit effects retain normal semantics. Catching a nested command failure prevents listener reporting; letting it escape produces one `ListenerError` with that command error as its cause.

Without `onError`, timer and listener failures are thrown asynchronously using host `queueMicrotask`, falling back to `TimeDriver.setTimeout` with zero delay. Reporting is independent of playback cancellation and destruction. Synchronous command failures are not additionally reported to the host.

If `onError` throws, Core asynchronously reports an `AggregateError` containing the reported error and reporter exception. Errors arising while the reporter runs go directly to the host without re-entering the callback. Returned promises are not observed; asynchronous consumer work must handle its own rejected promises.

If the host cannot schedule reporting, delivery finishes other subscribers and queued updates before throwing a diagnostic `AggregateError`. It retains the error being reported and the transport failure, never becomes an `EngineError`, and does not roll back committed playback or loading. Multiple transport failures are aggregated; an existing engine command failure takes precedence. The diagnostic constructor is internal and is not exported.

`EngineError` extends the native `Error` class and is the common base of command and playback error classes. Other engine failures are normalized into `EngineError`, preserving their full value and existing cause chain in `cause`. `InvalidTransitionError`, `InvalidInputError`, `IndexOutOfBoundsError`, and `EngineDestroyedError` start as nonfatal. Fatal operation failures have dedicated types:

| Type                      | Failure boundary                                                                  |
| ------------------------- | --------------------------------------------------------------------------------- |
| `TokenizationError`       | Unexpected tokenizer failure; the session is cleared.                             |
| `SessionLoadError`        | Failure after session replacement begins; the session is cleared.                 |
| `ItemSelectionError`      | Presentation preparation during play, stop, navigation, or scheduled advancement. |
| `PlaybackSchedulingError` | Scheduling or cancelling playback, or reading its deadline.                       |

Each of these four classes sets `isFatal: true`. An invalid offset during item selection becomes the cause of an `ItemSelectionError`; the original `InvalidInputError` remains nonfatal. Preparing an OVP strategy replacement uses the nonfatal policy because failure preserves the existing presentation and strategy.

All concrete `EngineError` constructors take domain parameters first, followed by optional `ErrorOptionsWithMessage`. This exported interface extends native `ErrorOptions` with `readonly message?: string`. The optional `cause` retains the original thrown value; `message` overrides the class's default message, including when it is an empty string. These options do not expose `isFatal`; each class owns its default classification.

```text
InvalidTransitionError(from: string, action: string, options?: ErrorOptionsWithMessage)
IndexOutOfBoundsError(index: number, totalItems: number, options?: ErrorOptionsWithMessage)
ItemSelectionError(index: number, options?: ErrorOptionsWithMessage)
InvalidInputError(options?: ErrorOptionsWithMessage)
EngineDestroyedError(options?: ErrorOptionsWithMessage)
TokenizationError(options?: ErrorOptionsWithMessage)
SessionLoadError(options?: ErrorOptionsWithMessage)
PlaybackSchedulingError(options?: ErrorOptionsWithMessage)
```

`InvalidTransitionError`, `IndexOutOfBoundsError`, and `ItemSelectionError` expose their domain parameters as readonly fields. For example, `new ItemSelectionError(3, { cause: error })` reports `Failed to prepare item at index 3.` and exposes `index: 3`.

The base constructor is `new EngineError(message?: string, options?: EngineErrorOptions)`, with the default message `Engine operation failed.`. `EngineErrorOptions` extends native `ErrorOptions` with optional `isFatal: boolean`. The readonly effective flag is the supplied flag OR the flag of an `EngineError` cause, defaulting to `false`. A fatal cause also makes a normally nonfatal concrete error fatal. Normalization preserves existing engine errors; operation wrappers add context and classification without unwrapping cause chains.

Engine-created wrapper messages describe the failed operation rather than repeating the source message. Tokenization, loading, item preparation, and scheduling have their own context; unexpected failures reaching the handler use `Engine operation failed.`. Source exceptions and their messages remain intact in `cause`.

Snapshot preparation and listener delivery run through one publication operation. Callback and diagnostic transport failures are classified at their owning boundaries and bypass engine error handling. Clock exceptions or nonfinite timestamps become fatal errors. Fatal snapshots retain the last successful `sampledAtMs` and set remaining duration to `null` without reading the clock again. If sampling fails before a successful loading notification, the replacement session is cleared and the failure is reported as `SessionLoadError`.

Cancellation failures are fatal `PlaybackSchedulingError` instances. During fatal cleanup, a secondary cancellation failure cannot replace the original error or prevent its notification; callback revisions are invalidated before cancellation is attempted. `destroy()` clears session buffers and subscriptions even if cancellation throws, then propagates the cancellation error without publishing an update. The instance remains destroyed and repeated destruction is safe.

Fatal tokenization or loading failures clear the session before publication, including when the tokenizer throws an `InvalidInputError`. The empty `ERROR` session has `currentItem: null`, `currentIndex: 0`, `totalItems: 0`, progress `0`, total duration `0`, and remaining duration `null`. Speed and OVP preferences survive. Nonfatal token validation failures preserve the session; fatal playback or navigation failures retain the last valid selection and progress. Recovery requires `reset()`.

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

### Tokenizer contract

`TokenizerStrategy<T>` requires only `tokenize(input: T | T[]): Token<T>[]`. A `Token<T>` holds source content, its initial viewing offset, and its duration multiplier. `RsvpItem<T>` is a type alias for the same readonly shape, naming the effective presentation returned by `currentItem`. Its OVP may be overridden without modifying the source token. Neither type carries sequence position; use `currentIndex` on the engine or snapshot. Custom tokenizers need no OVP management methods. Injected tokenizer and strategy instances are retained by reference; applications own shared-instance mutations.

### Runtime OVP preferences

An optional engine `ovpStrategy` overrides presentation independently of the tokenizer's initial calculation. `setOvpStrategy(strategy: OvpStrategy | undefined): void` immediately prepares the selected string item. Upcoming and revisited items are calculated when selected, before scheduling their display period. Pause, speed changes, getters, and unrelated notifications reuse the selected result. Passing `undefined` restores the original token offset.

`loadTokens()` always preserves supplied offsets. The engine retains the successful load method with the session, so later strategy assignments cannot rewrite a pre-tokenized session. They still save the preference for subsequent `load()` calls. Stop, navigation, and replay preserve session origin; reset clears the session while retaining the strategy.

```typescript
engine.setOvpStrategy({ calculate: () => 0 });
engine.load("hello world"); // Selected string uses the engine strategy.
engine.loadTokens([{ value: "hello", ovpIndex: 2, durationMultiplier: 1 }]);
engine.setOvpStrategy({ calculate: () => 1 }); // Supplied offset stays 2.
engine.load("new text"); // String offsets now use 1.
engine.setOvpStrategy(undefined); // Restore the tokenizer's offsets.
```

The setter is valid in all nonfatal states, including empty input. Invalid strategy shapes and calls in `ERROR` throw `InvalidInputError`; calls after destruction throw `EngineDestroyedError`. It validates the current applicable result before committing the preference. Nonfatal preparation failures retain the prior strategy and playback; an already fatal cause enters `ERROR` even during assignment. Later item-selection failures are fatal, and loading failures follow the [clearing policy](#errors).

Engine mutation from inside synchronous tokenizer or OVP callbacks is rejected; subscriber commands run after the guard is released. Strategies must be synchronous and side-effect-free; retaining the previous reference cannot undo internal strategy mutations. Invalid returned tokens are nonfatal validation errors, while a thrown tokenizer failure is fatal.

Assignments preserve non-string and unchanged item references, frozen previous snapshots, position, progress, multipliers, pending deadlines, paused remainder, and cached timing. A changed selected offset produces `ovpChanged`; preference-only changes do not notify. Reassigning the same strategy instance recalculates the current applicable item. Work uses at most one strategy call per selection or assignment and O(1) staging storage; custom calculation cost depends on the strategy and word length. `DefaultOvpStrategy` reuses a grapheme segmenter per instance. Both enabled strategies calculate independently, once during tokenization and again during presentation.

## Scheduling

`DriftCorrectedScheduler.schedule(task, delayMs)` accepts positive finite delays. Ordinary timer lag is deducted from the next interval. Lag of at least one full interval rebases the timeline instead of emitting zero-delay catch-up bursts. `cancel()` clears the pending task and timeline.

Schedulers may implement `getDeadline(): number | null` to expose the pending task's effective deadline in the engine's `TimeDriver` clock. The default scheduler includes drift correction and returns `null` after cancellation or task execution. Core rejects non-finite deadlines as fatal failures. Schedulers that omit the method or return `null` use nominal deadline accounting.

Pause preserves the effective deadline's remainder. If that remainder is already zero, resume advances immediately or completes the final item without scheduling a zero delay. It publishes one `advanced` or `completed` update instead of `resumed`.

`SystemTimeDriver` prefers the host's monotonic `performance.now()` clock and falls back to ECMAScript's `Date.now()`. The default driver requires host-provided `setTimeout` and `clearTimeout` functions and fails fast when they are absent. Timerless environments can provide their own `TimeDriver` through dependency injection.

See [Architecture](./architecture/README.md) and [State Machine](./STATE-MACHINE.md).
