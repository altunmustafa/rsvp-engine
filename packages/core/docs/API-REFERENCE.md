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

Constructor tokenization failures are thrown so they cannot be lost before event listeners are attached.

### Playback methods

| Method                  | Effect                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- |
| `play()`                | Starts or resumes playback. A fresh session emits its first item immediately. |
| `pause()`               | Cancels the timer and preserves the current item and remaining display time.  |
| `stop()`                | Stops only in `PLAYING` or `PAUSED`; resets index and retains data.           |
| `seek(index)`           | Selects an item and enters `PAUSED`; valid from paused or terminal states.    |
| `next()` / `previous()` | Navigates while paused.                                                       |
| `reset()`               | Recovers a fatal `ERROR` state to empty `IDLE`.                               |
| `destroy()`             | Idempotently cancels timers and removes listeners.                            |

Invalid control commands emit `error` and preserve the current state. They do not turn a usable session into a terminal error.

`seek(index)` requires a finite integer in `[0, totalItems)` and a state of `PAUSED`, `STOPPED`, or `COMPLETED`. Invalid indices emit `IndexOutOfBoundsError` before checking state and preserve selection, progress, and scheduling. Empty input has no valid seek index.

`stop()` resets index and progress to zero while retaining loaded data, but only from `PLAYING` or `PAUSED`. Calls from `IDLE`, `STOPPED`, `COMPLETED`, or `ERROR` emit `InvalidTransitionError` and preserve state, position, and progress. It is not idempotent; a completed session remains completed. See the [Stop state contract](./STATE-MACHINE.md#stop-behavior).

### Data and speed methods

- `load(data)` synchronously invokes the configured tokenizer.
- `loadTokens(tokens)` accepts externally prepared tokens, including results produced asynchronously outside the engine.
- Loading is rejected while `PLAYING` or `ERROR`.
- `setWpm(wpm)` and `setMsPerItem(ms)` affect subsequently scheduled display periods. They do not replace a running timer or a paused item's remaining duration.

The last speed input is preserved exactly as a JavaScript `number` in its supplied unit; the other unit is derived using `60_000 / value`. This applies to constructor options, getters, and snapshots, including fractional inputs. Constructor `msPerItem` takes precedence over `wpm` when both are supplied.

```typescript
engine.setWpm(225);
engine.wpm; // 225
engine.snapshot().wpm; // 225
engine.msPerItem; // 266.6666666666667

engine.setMsPerItem(engine.msPerItem);
engine.wpm; // 224.99999999999997: now derived from the explicit interval
```

Derived values retain normal floating-point precision without additional rounding. Strict equality between WPM and `60_000 / msPerItem` is not guaranteed after setting WPM. A snapshot does not record the source unit and is not a lossless speed-restoration format: passing both snapshot fields back as constructor options selects `msPerItem`.

Tokens require a non-negative integer `ovpIndex` (within string bounds for string values) and a positive finite `delayMultiplier`.

### State getters

- `state`, `currentIndex`, `currentItem`, `progress`, `totalItems`, `wpm`, `msPerItem`, and `snapshot()` are available.
- `currentIndex/currentItem` identify the selected or visibly presented item, never an internal next-item pointer.
- Progress is `0` before presentation and reaches `1` on the final item.

### Events

```typescript
engine.on("itemChange", ({ item, index, progress, reason }) => {});
engine.on("stateChange", ({ previous, current }) => {});
engine.on("complete", ({ item, totalItems }) => {});
engine.on("error", ({ error }) => {});
```

- `itemChange` is emitted exactly once whenever the presented item changes. Its `reason` is `playback`, `seek`, `next`, or `previous`.
- Resuming a paused item does not emit `itemChange` because the presented item has not changed.
- `on()` returns an unsubscribe function.

## Tokenization

`DefaultTokenizer` uses `Intl.Segmenter` for word boundaries when the runtime provides it and falls back to whitespace segmentation. `DefaultOvpStrategy` produces grapheme-aware JavaScript string offsets so consumers can safely use `slice()`.

Supported options are `sentenceDelay`, `clauseDelay`, `dashDelay`, `nestedTokenize`, and `ovpStrategy`. Delay values must be positive and finite. Custom OVP strategies implement `OvpStrategy` and can be injected without replacing the tokenizer:

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

`SystemTimeDriver` prefers the host's monotonic `performance.now()` clock and falls back to ECMAScript's `Date.now()`. The default driver requires host-provided `setTimeout` and `clearTimeout` functions and fails fast when they are absent. Timerless environments can provide their own `TimeDriver` through dependency injection.

See [Architecture](./architecture/README.md) and [State Machine](./STATE-MACHINE.md).
