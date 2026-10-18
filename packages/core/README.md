# `@rsvp-engine/core`

A headless, zero-dependency engine for Rapid Serial Visual Presentation (RSVP): show one item at a time with configurable speed and an optimal viewing position (OVP). Applications own rendering, input acquisition, and storage.

Runs in browsers, Node.js, Web Workers, and React Native. Ships ESM, CommonJS, and TypeScript declarations; runtime requirements are declared in [package.json](package.json).

## Installation

Using npm:

```bash
npm install @rsvp-engine/core
```

Using pnpm:

```bash
pnpm add @rsvp-engine/core
```

## Quick start

```typescript
import { RsvpEngine } from "@rsvp-engine/core";

const engine = new RsvpEngine({
  data: "Rapid Serial Visual Presentation powers modern speed reading.",
  wpm: 300,
  onError: (error) => console.error(error),
});

const unsubscribe = engine.subscribe((snapshot, eventType) => {
  console.log(eventType, snapshot.currentItem?.value, snapshot.progress, snapshot.state);
});

engine.play();
```

Call `unsubscribe()` to detach this listener. `engine.destroy()` cancels playback and removes all subscriptions when the reader's owner releases it.

## Configuration and commands

`new RsvpEngine<T = string>(options?)` accepts optional `RsvpEngineOptions<T>`:

| Option | Purpose |
| --- | --- |
| `data: T \| T[]` | Initial input; omit to start empty. |
| `wpm: number` | Base items per minute; defaults to `DEFAULT_WPM`. |
| `msPerItem: number` | Base display duration; takes precedence over `wpm`. |
| `tokenizer: TokenizerStrategy<T>` | Converts input into tokens; defaults to `DefaultTokenizer`. |
| `ovpStrategy: OvpStrategy` | Optional presentation override for strings loaded through `load()`. |
| `scheduler: SchedulerStrategy` | Schedules playback; defaults to `DriftCorrectedScheduler`. |
| `timeDriver: TimeDriver` | Supplies clock and timers; defaults to `SystemTimeDriver`. |
| `onError: (error: EngineError \| ListenerError) => void` | Handles timer and listener failures; see [Errors](#errors). |

All commands return `void`; invalid commands throw.

| Command | Behavior |
| --- | --- |
| `play()` | Starts nonempty `IDLE`, resumes `PAUSED`, or replays `STOPPED`/`COMPLETED` from index `0`. |
| `pause()` | Valid in `PLAYING`; preserves the current item's remaining display time. |
| `stop()` | Returns to `STOPPED` at index/progress `0`, retaining items and restoring full duration. No-op in `IDLE`/`STOPPED`; invalid in `ERROR`. |
| `seek(index)` | Selects a finite integer in `[0, totalItems)` from `IDLE`, `PAUSED`, `STOPPED`, or `COMPLETED`; enters `PAUSED` with a full item duration. |
| `next()` / `previous()` | Moves one item while `PAUSED`; no-op at an endpoint. |
| `load(data)` / `loadTokens(tokens)` | Replaces input and enters `IDLE`; rejected in `PLAYING` or `ERROR`. |
| `setWpm(wpm)` / `setMsPerItem(ms)` | Changes speed for future display periods, preserving the active or paused period. |
| `setOvpStrategy(strategy)` | Sets the presentation override; `undefined` restores original offsets. Rejected in `ERROR`. |
| `reset()` | Valid only in `ERROR`; clears data and returns to empty `IDLE`. |
| `destroy()` | Permanently cancels playback, clears session buffers, and removes all subscriptions; safe to repeat. |

Speed inputs accept finite fractional values within `MIN_WPM`/`MAX_WPM` or `MIN_MS_PER_ITEM`/`MAX_MS_PER_ITEM`. The supplied unit is preserved exactly; the other is derived as `60_000 / value` with normal floating-point precision.

Pause before seeking during playback; pause or stop before replacing playing data. Invalid seek indices throw `IndexOutOfBoundsError` before checking state and preserve position and timing. Empty input has no valid seek index.

## Snapshots and subscriptions

`getSnapshot(): RsvpSnapshot<T>` returns cached, readonly playback state. Its reference stays stable until observable state changes. `state`, `currentIndex`, `currentItem`, `progress`, `totalItems`, `wpm`, and `msPerItem` are also engine getters.

| Field                          | Meaning                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `state`                        | `IDLE`, `PLAYING`, `PAUSED`, `STOPPED`, `COMPLETED`, or fatal `ERROR`.     |
| `currentIndex` / `currentItem` | Zero-based selected position and `RsvpItem<T>`; `0` and `null` when empty. |
| `progress` / `totalItems`      | Playback-position fraction and loaded item count.                          |
| `wpm` / `msPerItem`            | Base rate and duration before item multipliers.                            |
| `timing`                       | Cached duration estimate described below.                                  |

Progress is `currentIndex / totalItems`, or `0` when empty, until `COMPLETED` sets it to `1`. The first item is presented immediately; completion waits for the final item's display period. Seeking measures position, not reading history. Use `state === "COMPLETED"` for completion.

`subscribe(listener: RsvpStoreListener<T>): UnsubscribeFn` calls `listener(snapshot, eventType)` synchronously on changes. It does not call the listener immediately; read `getSnapshot()` for initial state.

| `RsvpEventType`               | Operation                                    |
| ----------------------------- | -------------------------------------------- |
| `loaded` / `reset`            | Replace input or recover from `ERROR`.       |
| `started` / `resumed`         | Start/replay or continue a paused item.      |
| `paused` / `stopped`          | Pause or return to the beginning.            |
| `advanced` / `navigated`      | Advance during playback or select manually.  |
| `completed`                   | Finish the final display period.             |
| `speedChanged` / `ovpChanged` | Change observable speed or viewing position. |
| `stateChanged`                | A failure changes playback state.            |

Updates include completed scheduling. No-ops and rejected nonfatal commands do not notify. Nested commands deliver their snapshots in order; use the callback's snapshot because `getSnapshot()` may already reflect a nested command. Resuming an expired item publishes `advanced` or `completed` immediately.

Snapshots and item objects are frozen; generic `value` objects are not deeply frozen. Synchronous listener failures are isolated; see [Errors](#errors).

## Duration estimates

`getSnapshot().timing` is a frozen `RsvpTiming` sample:

| Field                 | Meaning                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `totalDurationMs`     | Full content duration at the selected speed, including item multipliers. |
| `remainingDurationMs` | Current-item remainder plus future periods; `null` in `ERROR`.           |
| `sampledAtMs`         | Timestamp in the engine's `TimeDriver` clock, not necessarily Unix time. |

Loading, playback/navigation, and effective speed changes update timing; reads, no-ops, and OVP-only changes do not. Pause freezes the remainder; seek gives the selected item a full period. In `IDLE`/`STOPPED`, remaining equals total; empty input and completion have zero remaining time. After a speed increase, the retained current period can make remaining exceed total.

Estimates exclude pauses and future host delays. For a countdown, share the engine's clock, subtract `now() - sampledAtMs` only while `PLAYING`, clamp to zero, and rebase on new samples. The engine adds no countdown timer. In `ERROR`, the timestamp retains the last successful sample.

## Tokenization and custom strategies

`DefaultTokenizer` splits strings with `Intl.Segmenter`, falling back to whitespace. Array elements and non-string values are individual tokens; `nestedTokenize: true` also tokenizes array contents. Configure punctuation through `sentenceDurationMultiplier`, `clauseDurationMultiplier`, and `dashDurationMultiplier`, or inject a tokenizer `ovpStrategy` for initial offsets.

A source `Token<T>` and its presented `RsvpItem<T>` share readonly fields: `value: T`, `ovpIndex: number`, and `durationMultiplier: number`. The OVP is a non-negative integer UTF-16 offset, at most the string length, suitable for `slice()`. The multiplier must be positive and finite; display duration is `msPerItem * durationMultiplier`. Position belongs to `currentIndex`.

Use `loadTokens()` for prepared input, including asynchronous work done outside the engine:

```typescript
const reader = new RsvpEngine<{ label: string }>();
reader.loadTokens([{ value: { label: "One" }, ovpIndex: 0, durationMultiplier: 1 }]);
```

| Strategy | Contract |
| --- | --- |
| `TokenizerStrategy<T>` | `tokenize(input: T \| T[]): Token<T>[]`; produces initial offsets and multipliers. |
| `OvpStrategy` | `calculate(text: string): number`; chooses a viewing offset. `DefaultOvpStrategy` is grapheme-aware. |
| `SchedulerStrategy` | `schedule(task: () => void, delayMs: number): void`; `cancel(): void`; optional `getDeadline(): number \| null` in the engine clock. |
| `TimeDriver` | `now(): number` (finite milliseconds); `setTimeout(callback: () => void, ms: number): unknown`; `clearTimeout(handle: unknown): void`. |

Injected instances remain externally owned. Tokenizer and OVP callbacks must be synchronous and side-effect-free; engine mutation inside them is rejected.

The default scheduler corrects ordinary lag and rebases after severe delays. A custom scheduler should share the engine clock; without a deadline, accounting is nominal. `SystemTimeDriver` uses `performance.now()` or `Date.now()` and requires host timers.

### Presentation OVP overrides

An engine `ovpStrategy` is independent of the tokenizer's initial calculation. `setOvpStrategy()` updates the selected string; upcoming and revisited strings are calculated when selected. Non-string items and `loadTokens()` offsets stay unchanged.

```typescript
engine.setOvpStrategy({ calculate: () => 0 });
engine.setOvpStrategy(undefined); // Restore initial token offsets.
```

The preference survives Stop, reset, and replacement input. Changes preserve position and timing; only a changed selected offset publishes `ovpChanged`. Nonfatal assignment failures preserve the previous strategy and playback. Failures during later selection enter `ERROR`; failures during loading clear the session.

## Errors

Catch construction and synchronous command failures at their call site; they do not invoke `onError`:

```typescript
try {
  engine.play();
} catch (error) {
  console.error(error);
}
```

Timer and synchronous listener failures use `onError(error: EngineError | ListenerError)`. Without it, they reach the host as asynchronous unhandled errors. Listeners remain isolated so other listeners and queued updates continue. If a command error escapes a listener, it becomes one `ListenerError` with that error as its cause.

| Error family | Meaning |
| --- | --- |
| `EngineError` | Base for command/playback errors; exposes readonly `isFatal` and original `cause`. |
| `InvalidTransitionError`, `InvalidInputError`, `IndexOutOfBoundsError`, `EngineDestroyedError` | Rejected commands or input; ordinarily nonfatal. |
| `TokenizationError`, `SessionLoadError` | Fatal input preparation or loading failure. |
| `ItemSelectionError`, `PlaybackSchedulingError` | Fatal selection or scheduling failure. |
| `ListenerError` | Separate `Error` subclass with `eventType` and `cause`; no engine fatality. |

Use `instanceof` and `cause` for diagnostics. Concrete errors supply default messages and accept optional `ErrorOptionsWithMessage` (`{ message, cause }`) after domain arguments, such as `new ItemSelectionError(index, { cause })`. The base accepts `new EngineError(message, { cause, isFatal })` using `EngineErrorOptions`. A fatal engine-error cause cannot be downgraded by wrapping it.

Nonfatal validation failures preserve playback. Fatal failures cancel advancement and publish `ERROR` before error delivery. Fatal loading clears the session, including selection and progress; fatal playback/navigation preserves the last valid selection and progress. Speed and OVP preferences survive; call `reset()` before loading again. Snapshots contain no error details, so applications own messages and history.

Callbacks are synchronous; handle rejected promises in asynchronous application work. A failing reporter produces an asynchronously reported `AggregateError` without recursive reporting.

## Lifecycle

Call `destroy()` when the owner releases the reader. It cancels playback, clears session buffers, and removes all subscriptions without notifying. Commands and new subscriptions then throw `EngineDestroyedError`; all post-destroy reads are unsupported. Capture required snapshots beforehand. Repeated destruction and existing unsubscribe functions are safe; captured snapshots remain unchanged. Destruction still ends the lifetime if cancellation throws.

## Migration

For upgrades across multiple major versions, apply these steps in version order. Removed APIs have no compatibility aliases.

### Core 2 → 3

- Catch all synchronous command failures; use `onError` for timer/listener failures. Replace `snapshot.error`, `clearError()`, `errorOccurred`, and `errorCleared` with application-owned diagnostics and `stateChanged` for fatal transitions.
- Errors use the `EngineError` family and retain source failures in `cause`. Replace `new InvalidInputError(message)` with `new InvalidInputError({ message })`. Listener exceptions are isolated as `ListenerError`.
- Include `ovpChanged` in exhaustive event handlers; use `ovpStrategy`/`setOvpStrategy()` for presentation overrides. Tokenizer contracts and supplied token offsets are unchanged.
- Replace `currentItem.index` with `currentIndex`. Progress uses `currentIndex / totalItems` and reaches `1` only after the final display period.
- Handle empty sessions after fatal loading; recover with `reset()`.
- Capture snapshots before destruction and stop post-destroy reads.

### Core 1 → 2

#### Migrating subscriptions

Replace `on(...)` with `subscribe((snapshot, eventType) => ...)` and `snapshot()` with `getSnapshot()`. `EventEmitter`, event maps, legacy payload types, and `itemChange.reason` are removed. Core 2 stored errors in its flat snapshot; Core 3 removes that field as described above.

#### Migrating duration multipliers

| Previous name                                        | Replacement                  |
| ---------------------------------------------------- | ---------------------------- |
| `Token.delayMultiplier` / `RsvpItem.delayMultiplier` | `durationMultiplier`         |
| `sentenceDelay`                                      | `sentenceDurationMultiplier` |
| `clauseDelay`                                        | `clauseDurationMultiplier`   |
| `dashDelay`                                          | `dashDurationMultiplier`     |

Multiplier values and pacing are unchanged.

### Core 0 → 1

#### Migrating API names

Use `Rsvp`/`Ovp` casing in place of `RSVP`/`OVP` in API names: for example, `RSVPEngine` → `RsvpEngine` and `DefaultOVPStrategy` → `DefaultOvpStrategy`. Replace `setSpeed(wpm)` with `setWpm(wpm)`. Uppercase constants and state strings retain their names.

## License

[MIT](./LICENSE)
