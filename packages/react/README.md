# `@rsvp-engine/react`

Headless React bindings for `@rsvp-engine/core`. A controller owns playback; typed context hooks connect it to your UI. The package supports React Native without importing React DOM, browser globals, or styles.

## Installation

```sh
pnpm add @rsvp-engine/react react
```

React is a peer dependency; supported versions are declared in [package.json](package.json).

## Basic usage

Create the context bundle once at module scope. This example uses a controller owned by a single client-side application:

```tsx
import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController({ data: "Read this text", wpm: 300 });
const { RsvpProvider, useRsvpSelector, useRsvpActions } = createRsvpContext<string>();

function Word() {
  const word = useRsvpSelector((snapshot) => snapshot.currentItem?.value);
  return <strong>{word}</strong>;
}

function Controls() {
  const state = useRsvpSelector((snapshot) => snapshot.state);
  const totalItems = useRsvpSelector((snapshot) => snapshot.totalItems);
  const { play, pause, stop } = useRsvpActions();
  const canPlay = totalItems > 0 && state !== "PLAYING" && state !== "ERROR";

  return (
    <>
      <button onClick={play} disabled={!canPlay}>
        Play
      </button>
      <button onClick={pause} disabled={state !== "PLAYING"}>
        Pause
      </button>
      <button onClick={stop} disabled={state !== "PLAYING" && state !== "PAUSED"}>
        Stop
      </button>
    </>
  );
}

function App() {
  return (
    <RsvpProvider controller={controller}>
      <Word />
      <Controls />
    </RsvpProvider>
  );
}
```

## React context and hooks

`createRsvpContext<T = string>()` returns an isolated, typed Provider and three hooks. Hooks must run under their matching Provider or they throw. Different bundles can represent independent readers or item types.

| API | Behavior |
| --- | --- |
| `RsvpProvider` | Accepts `controller: RsvpController<T>` and optional React `children`. Replacing the controller moves selector subscriptions to the new instance. |
| `useRsvpSelector(selector, equalityFn?)` | Selects from the flat `RsvpSnapshot<T>`, including `error`. Rerenders only when the selected value changes; comparison defaults to `Object.is`. |
| `useRsvpActions()` | Returns a frozen command object, stable while the controller stays the same. Does not subscribe to playback. Excludes `destroy`. |
| `useRsvpController()` | Returns the provided controller without subscribing. Use for imperative integrations; reading `getSnapshot()` through it does not make a component reactive. |

Selectors must be pure. When returning an object, provide an equality function to avoid rerenders for equivalent values:

```tsx
const status = useRsvpSelector(
  (snapshot) => ({ state: snapshot.state, wpm: snapshot.wpm }),
  (left, right) => left.state === right.state && left.wpm === right.wpm,
);
```

## Controller API

### `createRsvpController<T = string>(options?)`

Creates and owns one Core engine, delegates its commands and observable store, and preserves the construction-time server snapshot. All options are optional; construction failures throw.

| Option | Type | Behavior |
| --- | --- | --- |
| `data` | `T \| T[]` | Initial input, tokenized synchronously. Omit to start empty. |
| `wpm` | `number` | Defaults to `DEFAULT_WPM`; valid between `MIN_WPM` and `MAX_WPM`, inclusive. |
| `msPerItem` | `number` | Base duration between `MIN_MS_PER_ITEM` and `MAX_MS_PER_ITEM`, inclusive. Takes precedence over `wpm`. |
| `tokenizer` | `TokenizerStrategy<T>` | Defaults to Core's Unicode-aware text tokenizer. |
| `scheduler` | `SchedulerStrategy` | Defaults to Core's drift-corrected scheduler. |
| `timeDriver` | `TimeDriver` | Clock and timers for scheduling and pause/resume accounting. |

The default tokenizer wraps non-string values as individual items and treats array elements as individual tokens.

### Commands

Available on the controller and through `useRsvpActions()`; all return `void`.

| Method | Behavior |
| --- | --- |
| `play()` | Starts from nonempty `IDLE`, resumes `PAUSED`, or replays `STOPPED`/`COMPLETED` from index `0`. |
| `pause()` | Valid only in `PLAYING`; preserves the item and remaining display time. |
| `stop()` | Valid only from `PLAYING` or `PAUSED`; resets index and progress to `0`, retaining data. |
| `seek(index: number)` | Requires an in-bounds finite integer; enters `PAUSED` from `PAUSED`, `STOPPED`, or `COMPLETED`. |
| `next()` / `previous()` | Moves one item while `PAUSED`; does nothing at the boundary. |
| `reset()` | Clears data and recovers `ERROR` to `IDLE`. Only valid from `ERROR`. |
| `load(data: T \| T[])` | Replaces input through the tokenizer; rejected while `PLAYING` or `ERROR`. |
| `loadTokens(tokens: Token<T>[])` | Replaces input with prepared tokens; same state restrictions as `load`. |
| `setWpm(wpm: number)` | Sets the base reading rate. |
| `setMsPerItem(ms: number)` | Sets the base item duration. |
| `clearError()` | Clears the observable error without resetting playback. |

Pause or stop before loading during playback; reset after a fatal error before loading again. Loading leaves the engine in `IDLE`.

Invalid seek indices record `IndexOutOfBoundsError` before checking state and preserve position, progress, and scheduling. Empty input has no valid seek index.

Speed commands accept finite fractional values within the exported limits. The supplied unit is preserved exactly; the other is derived as `60_000 / value` with normal floating-point precision. Changes affect future display periods, preserving a running timer or paused item's remaining duration. Each token's `durationMultiplier` scales its display duration.

### Snapshots and subscriptions

| Method | Behavior |
| --- | --- |
| `getSnapshot()` | Cached live `RsvpSnapshot<T>`; reference stays stable until observable state changes. |
| `getServerSnapshot()` | Immutable construction-time snapshot for server rendering. |
| `subscribe(listener: RsvpStoreListener<T>)` | Receives `(snapshot, eventType)` on changes; does not invoke the listener immediately. Returns an unsubscribe function. |
| `destroy()` | Permanently releases timers and subscriptions; idempotent. |

The snapshot has readonly fields:

| Field               | Meaning                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| `state`             | `"IDLE" \| "PLAYING" \| "PAUSED" \| "STOPPED" \| "COMPLETED" \| "ERROR"`.           |
| `currentIndex`      | Zero-based selected or presented index; `0` when empty.                             |
| `currentItem`       | `RsvpItem<T> \| null`, with `value`, `index`, `ovpIndex`, and `durationMultiplier`. |
| `progress`          | `0` before presentation; reaches `1` on the final item.                             |
| `totalItems`        | Loaded token count.                                                                 |
| `wpm` / `msPerItem` | Base reading rate and display duration.                                             |
| `timing`            | Frozen `RsvpTiming` sample with total duration, remaining duration, and timestamp.  |
| `error`             | Last engine error, or `null`.                                                       |

The final item still needs its display period after progress reaches `1`. Use `state === "COMPLETED"` to detect completion.

Each notification carries one `RsvpEventType`: `loaded`, `started`, `resumed`, `paused`, `stopped`, `advanced`, `navigated`, `completed`, `speedChanged`, `reset`, `errorOccurred`, or `errorCleared`. Failed commands use `errorOccurred`; successful load/reset include error clearing in their own update. No-ops do not notify. Nested commands queue notifications in order; use the supplied snapshot for its event. Subscriber exceptions interrupt delivery and propagate.

### Duration estimates

Select timing with `useRsvpSelector((snapshot) => snapshot.timing)`:

| Field                 | Meaning                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `totalDurationMs`     | Fresh playback estimate at the selected speed, including item multipliers.    |
| `remainingDurationMs` | Retained current-item remainder plus future periods; `null` in fatal `ERROR`. |
| `sampledAtMs`         | Timestamp in the controller's `TimeDriver` clock, not necessarily Unix time.  |

Samples update on loading, playback/navigation changes, and effective speed changes. Reads, no-ops, and nonfatal error changes do not resample. Pause freezes the remainder; navigation gives the selected item a full period. Before playback and after stop, remaining equals total; empty input and completion have zero remaining time. Speed increases can make remaining exceed total because the active item's older period is retained. Estimates exclude pauses and future host delays.

Neither Core nor React adds a countdown timer. For a live countdown, share the controller's `TimeDriver`, subtract `now() - sampledAtMs` only while `PLAYING`, and clamp to zero. Rebase on each new sample and clean up UI timers on pause/unmount. Loading prepares O(n) suffix sums; subsequent estimates take O(1).

### Errors

Select `error` with `useRsvpSelector(({ error }) => error)`. It is an `Error | null` and is owned by Core. It clears on `clearError()`, successful `load/loadTokens()`, or successful `reset()`; other commands retain it. Clearing it does not recover an engine in `ERROR`; use `reset()`.

Invalid transitions and navigation report observable errors without necessarily throwing. Synchronous failures, such as invalid speed input, are recorded and rethrown. Handle both observable errors and thrown exceptions. Ordinary invalid commands preserve usable state; fatal failures enter `ERROR`.

## Lifecycle and server rendering

The application owns the controller. Provider and hook unmounts only remove subscriptions. Pause when a reader session becomes inactive; call `destroy()` when its owner permanently releases it. Avoid creating or destroying controllers as render side effects.

Cached snapshots remain readable after destruction; commands and new subscriptions throw `EngineDestroyedError`.

For SSR, create controllers per request with matching initial data on the server and client. Selectors read the construction-time snapshot, including timing, during server rendering and switch to live state during hydration.

## Custom items and strategies

Use the same item type for `createRsvpController<T>()` and `createRsvpContext<T>()`. A `Token<T>` contains `value: T`, `ovpIndex: number`, and `durationMultiplier: number`. The OVP is a non-negative integer UTF-16 offset, no greater than string length, suitable for `slice()`. The duration multiplier must be positive and finite.

Prepare asynchronous input outside the controller, then pass tokens to `loadTokens`. Inject strategies through controller options:

| Type | Contract |
| --- | --- |
| `TokenizerStrategy<T>` | `tokenize(input: T \| T[]): Token<T>[]` |
| `SchedulerStrategy` | `schedule(task: () => void, delayMs: number): void`; `cancel(): void`; optional `getDeadline(): number \| null` in the engine clock. |
| `TimeDriver` | `now(): number`; `setTimeout(callback: () => void, ms: number): unknown`; `clearTimeout(handle: unknown): void` |
| `OvpStrategy` | `calculate(text: string): number`, returning the preferred UTF-16 offset. Inject through a compatible tokenizer. |

Concrete tokenizer and scheduler classes are available from `@rsvp-engine/core`. Its `DefaultTokenizer` uses `Intl.Segmenter` with a whitespace fallback; its default scheduler corrects ordinary lag and rebases after severe lag. The default time driver requires host timers. Custom schedulers without a deadline use nominal accounting; resume of an expired item advances or completes immediately instead of publishing `resumed`.

## Migration

### React 0 → 1

Apply these changes when upgrading from React 0 to React 1, which uses Core 2; old APIs have no compatibility aliases. New integrations use the API described above.

| Previous usage | Replacement |
| --- | --- |
| `getSnapshot().snapshot.progress` | `getSnapshot().progress`; snapshots are flat and include `error` and `timing`. |
| `({ snapshot }) => snapshot.progress` | `(snapshot) => snapshot.progress` in selectors. |
| `subscribe(() => ...)` | Existing callbacks can remain; use `(snapshot, eventType) => ...` to receive the complete update and its operation. |
| `Token.delayMultiplier` / `RsvpItem.delayMultiplier` | `durationMultiplier` in custom tokens, tokenizer output, and item reads. |
| `sentenceDelay` / `clauseDelay` / `dashDelay` | `sentenceDurationMultiplier` / `clauseDurationMultiplier` / `dashDurationMultiplier` in Core tokenizer options. |

Successful `load/loadTokens()` and `reset()` now clear errors in the same notification; `clearError()` remains available. Check `state === "ERROR"` for fatal recovery rather than relying on an old error remaining after load/reset. Resume of an expired item publishes `advanced` or `completed`, not `resumed`.

Controller ownership, context hooks, and `getServerSnapshot()` retain their roles. Multipliers retain their positive finite values and pacing. React 0 already uses `Rsvp`/`Ovp` names and `setWpm`; Core's earlier naming migration does not require changes to these React releases.

## Exports and license

The package exports the controller/context factories and their types, Core snapshot/item/timing and strategy types, speed constants, and `EngineDestroyedError`, `IndexOutOfBoundsError`, `InvalidInputError`, and `InvalidTransitionError`.

[MIT](./LICENSE)
