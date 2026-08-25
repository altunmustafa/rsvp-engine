# API Reference: `@rsvp-engine/core`

## `RSVPEngine<T = string>`

```typescript
new RSVPEngine<T>(options?: RSVPEngineOptions<T>)
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
| `stop()`                | Cancels playback and resets selection to index `0`.                           |
| `seek(index)`           | Selects an item and enters `PAUSED`; valid from paused or terminal states.    |
| `next()` / `previous()` | Navigates while paused.                                                       |
| `reset()`               | Recovers a fatal `ERROR` state to empty `IDLE`.                               |
| `destroy()`             | Idempotently cancels timers and removes listeners.                            |

Invalid control commands emit `error` and preserve the current state. They do not turn a usable session into a terminal error.

### Data and speed methods

- `load(data)` synchronously invokes the configured tokenizer.
- `loadTokens(tokens)` accepts externally prepared tokens, including results produced asynchronously outside the engine.
- Loading is rejected while `PLAYING` or `ERROR`.
- `setSpeed(wpm)` and `setMsPerItem(ms)` affect subsequently scheduled display periods.

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

`DefaultTokenizer` uses `Intl.Segmenter` for word boundaries when the runtime provides it and falls back to whitespace segmentation. `DefaultOVPStrategy` produces grapheme-aware JavaScript string offsets so consumers can safely use `slice()`.

Supported options are `sentenceDelay`, `clauseDelay`, `dashDelay`, `nestedTokenize`, and `ovpStrategy`. Delay values must be positive and finite. Custom OVP strategies implement `OVPStrategy` and can be injected without replacing the tokenizer:

```typescript
class LastCharacterOVPStrategy implements OVPStrategy {
  calculate(text: string): number {
    return Math.max(0, text.length - 1);
  }
}

const tokenizer = new DefaultTokenizer({
  ovpStrategy: new LastCharacterOVPStrategy(),
});
```

## Scheduling

`DriftCorrectedScheduler.schedule(task, delayMs)` accepts positive finite delays. Ordinary timer lag is deducted from the next interval. Lag of at least one full interval rebases the timeline instead of emitting zero-delay catch-up bursts. `cancel()` clears the pending task and timeline.

`SystemTimeDriver` prefers the host's monotonic `performance.now()` clock and falls back to ECMAScript's `Date.now()`. The default driver requires host-provided `setTimeout` and `clearTimeout` functions and fails fast when they are absent. Timerless environments can provide their own `TimeDriver` through dependency injection.

See [Architecture](./architecture/README.md) and [State Machine](./STATE-MACHINE.md).
