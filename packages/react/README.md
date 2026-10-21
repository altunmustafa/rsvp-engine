# `@rsvp-engine/react`

Headless React bindings for `@rsvp-engine/core`. A controller owns playback; typed context hooks connect it to your UI. Works with React Native and supplies no DOM components or styles.

## Installation

Using npm:

```bash
npm install @rsvp-engine/react react
```

Using pnpm:

```bash
pnpm add @rsvp-engine/react react
```

React is a peer dependency; supported versions and runtime requirements are declared in [package.json](package.json).

## Basic usage

Create the context bundle once at module scope. This example uses a controller owned by a single client-side application:

```tsx
import { TextTokenizer } from "@rsvp-engine/react/core";
import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController({ tokenizer: new TextTokenizer(), wpm: 300 });
controller.load("Read this text");
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
      <button onClick={stop} disabled={state === "ERROR"}>
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

The application owns the controller; see [Lifecycle and server rendering](#lifecycle-and-server-rendering) for cleanup and SSR.

## React context and hooks

`createRsvpContext<T = string>()` returns a typed Provider and three hooks. Every hook requires its matching Provider. Separate bundles support independent readers or item types.

| API | Behavior |
| --- | --- |
| `RsvpProvider` | Accepts `controller: RsvpController<T>` and optional `children`. Replacing the controller moves subscriptions to it. |
| `useRsvpSelector(selector, equalityFn?)` | Reads reactive snapshot data; rerenders only when the selected value changes. Defaults to `Object.is`. |
| `useRsvpActions()` | Returns frozen commands, stable per controller, without subscribing. Excludes `destroy`. |
| `useRsvpController()` | Returns the controller for imperative use. Calling `getSnapshot()` does not make a component reactive. |

Selectors must be pure. Supply an equality function when selecting an object:

```tsx
const status = useRsvpSelector(
  (snapshot) => ({ state: snapshot.state, wpm: snapshot.wpm }),
  (left, right) => left.state === right.state && left.wpm === right.wpm,
);
```

## Controller API

`createRsvpController<T = string, TMeta = unknown>(options?)` creates an empty Core engine with optional `RsvpControllerOptions<T, TMeta>`. Supply a tokenizer to use `load()`, or use `loadTokens()` without one. No tokenizer is selected automatically. Import Core APIs, including `TextTokenizer`, from `@rsvp-engine/react/core`; Core is installed as a dependency of the React package.

| Option | Purpose |
| --- | --- |
| `wpm: number` | Base items per minute; defaults to `DEFAULT_WPM`. |
| `msPerItem: number` | Base duration; takes precedence over `wpm`. |
| `tokenizer: TokenizerStrategy<T, TMeta>` | Optional raw-input converter for `load()`; must produce tokens compatible with `TMeta`. |
| `ovpStrategy: OvpStrategy` | Optional presentation override for strings loaded through `load()`. |
| `scheduler: SchedulerStrategy` | Schedules playback; defaults to Core's drift-corrected scheduler. |
| `timeDriver: TimeDriver` | Supplies clock and timers; defaults to Core's system driver. |
| `onError: (error: EngineError \| ListenerError) => void` | Handles timer and listener failures; see [Errors](#errors). |

### Commands

Available on the controller and through `useRsvpActions()`. All return `void`; invalid commands throw.

| Command | Behavior |
| --- | --- |
| `play()` | Starts nonempty `IDLE`, resumes `PAUSED`, or replays `STOPPED`/`COMPLETED` from index `0`. |
| `pause()` | Valid in `PLAYING`; preserves the current item's remaining display time. |
| `stop()` | Enters `STOPPED` at index/progress `0`, retaining items and restoring full duration. No-op in `IDLE`/`STOPPED`; invalid in `ERROR`. |
| `seek(index)` | Selects a finite integer in `[0, totalItems)` from `IDLE`, `PAUSED`, `STOPPED`, or `COMPLETED`; enters `PAUSED` with a full item duration. |
| `next()` / `previous()` | Moves one item while `PAUSED`; no-op at an endpoint. |
| `load(data)` / `loadTokens(tokens)` | Replaces input and enters `IDLE`; rejected in `PLAYING` or `ERROR`. `load()` requires a configured tokenizer; `loadTokens()` does not. |
| `setWpm(wpm)` / `setMsPerItem(ms)` | Changes future display periods, preserving the active or paused period. |
| `setOvpStrategy(strategy)` | Sets the presentation override; `undefined` restores initial offsets. Rejected in `ERROR`. |
| `reset()` | Valid only in `ERROR`; clears data and returns to empty `IDLE`. |

Pause before seeking or replacing playing data. Invalid seek indices throw `IndexOutOfBoundsError` before checking state and preserve position and timing. Empty input has no valid seek index.

Speed inputs accept finite fractional values within the exported `MIN_WPM`/`MAX_WPM` or `MIN_MS_PER_ITEM`/`MAX_MS_PER_ITEM` limits. The supplied unit is preserved exactly; the other is derived as `60_000 / value` with normal floating-point precision.

### Snapshots and subscriptions

`RsvpControllerSnapshot<T, TMeta>` is the readonly `RsvpSnapshot<T, TMeta>` exposed to selectors.

| Method | Behavior |
| --- | --- |
| `getSnapshot()` | Cached live snapshot; reference stays stable until observable state changes. |
| `getServerSnapshot()` | Immutable construction-time snapshot with empty content for SSR. |
| `subscribe(listener: RsvpStoreListener<T, TMeta>)` | Calls `listener(snapshot, eventType)` synchronously on changes; returns an unsubscribe function. |
| `destroy()` | Permanently cancels playback, clears session buffers, and removes all subscriptions; safe to repeat. |

| Snapshot field                 | Meaning                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `state`                        | `IDLE`, `PLAYING`, `PAUSED`, `STOPPED`, `COMPLETED`, or fatal `ERROR`.            |
| `currentIndex` / `currentItem` | Zero-based selected position and `RsvpItem<T, TMeta>`; `0` and `null` when empty. |
| `progress` / `totalItems`      | Playback-position fraction and loaded item count.                                 |
| `wpm` / `msPerItem`            | Base rate and duration before item multipliers.                                   |
| `timing`                       | Frozen duration sample described below.                                           |

Progress is `currentIndex / totalItems`, or `0` when empty, until `COMPLETED` sets it to `1`. The first item is presented immediately; completion waits for the final display period. Seeking measures position, not reading history. Use `state === "COMPLETED"` for completion.

Direct subscriptions do not invoke listeners immediately; read `getSnapshot()` for initial state. Each notification carries a `RsvpEventType`: `loaded`, `started`, `resumed`, `paused`, `stopped`, `advanced`, `navigated`, `completed`, `speedChanged`, `ovpChanged`, `reset`, or `stateChanged`. Fatal failures publish `stateChanged`; no-ops and rejected nonfatal commands do not notify.

Nested updates arrive in order; use the callback's snapshot because `getSnapshot()` may already reflect a nested command. Resuming an expired item publishes `advanced` or `completed` immediately. Snapshot and item objects are frozen; application-owned `value` and `meta` objects are not deeply frozen.

### Duration estimates

Select `snapshot.timing` or one of its `RsvpTiming` fields:

| Field                 | Meaning                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `totalDurationMs`     | Full content duration at the selected speed, including item multipliers.     |
| `remainingDurationMs` | Current-item remainder plus future periods; `null` in `ERROR`.               |
| `sampledAtMs`         | Timestamp in the controller's `TimeDriver` clock, not necessarily Unix time. |

Loading, playback/navigation, and effective speed changes update timing; reads, no-ops, and OVP-only changes do not. Pause freezes the remainder; seek gives the selected item a full period. In `IDLE`/`STOPPED`, remaining equals total; empty input and completion have zero remaining time. After a speed increase, the retained current period can make remaining exceed total.

Estimates exclude pauses and future host delays. For a countdown, share the controller's clock, subtract `now() - sampledAtMs` only while `PLAYING`, clamp to zero, and rebase on new samples. Clean up UI timers on pause/unmount; the package adds no countdown timer. In `ERROR`, timing retains the last successful timestamp.

## Custom items and strategies

Use matching item and metadata types for `createRsvpController<T, TMeta>()` and `createRsvpContext<T, TMeta>()`. Metadata defaults to `unknown`. The default tokenizer splits strings with `Intl.Segmenter` or a whitespace fallback; array elements and non-string values are individual items.

A source `Token<T, TMeta>` and its presented `RsvpItem<T, TMeta>` share readonly fields: `value: T`, `ovpIndex: number`, `durationMultiplier: number`, and application metadata `meta`. Metadata is required unless `TMeta` accepts `undefined`. The OVP is a non-negative integer UTF-16 offset, at most the string length, suitable for `slice()`. Multipliers must be positive and finite; display duration is `msPerItem * durationMultiplier`. Read position through `currentIndex`.

Prepare asynchronous input outside the controller, then pass tokens to `loadTokens()`:

```typescript
controller.loadTokens([{ value: "hello", ovpIndex: 2, durationMultiplier: 1 }]);
```

| Strategy | Contract |
| --- | --- |
| `TokenizerStrategy<T, TMeta>` | `tokenize(input: T \| T[]): Token<T, TMeta>[]`; produces initial offsets, multipliers, and metadata governed by `TMeta`. |
| `OvpStrategy` | `calculate(text: string): number`; chooses a viewing offset. |
| `SchedulerStrategy` | `schedule(task: () => void, delayMs: number): void`; `cancel(): void`; optional `getDeadline(): number \| null` in the engine clock. |
| `TimeDriver` | `now(): number` (finite milliseconds); `setTimeout(callback: () => void, ms: number): unknown`; `clearTimeout(handle: unknown): void`. |

Core's complete public API, including its tokenizer, OVP, scheduler, time-driver classes, types, errors, and constants, is available from `@rsvp-engine/react/core`. The React root exports only its controller and context bindings and their types. The Core subpath re-exports the dependency without bundling a separate copy or importing React. Injected instances stay externally owned. Tokenizer and OVP callbacks must be synchronous and side-effect-free; engine mutation inside them is rejected. Custom schedulers should share the engine clock; without a deadline, accounting is nominal. The default driver requires host timers.

### Application metadata

Attach application data through a custom tokenizer or `loadTokens()`. For example, a consumer-defined source span can use JavaScript UTF-16 `[start, end)` offsets:

```tsx
import type { ReactNode } from "react";
import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";

interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

const controller = createRsvpController<string, SourceSpan>();
controller.loadTokens([{ value: "hello", ovpIndex: 2, durationMultiplier: 1, meta: { start: 0, end: 5 } }]);
const { RsvpProvider, useRsvpSelector } = createRsvpContext<string, SourceSpan>();

function SourceOffset(): ReactNode {
  const span = useRsvpSelector((snapshot) => snapshot.currentItem?.meta);
  return <span>{span?.start}</span>;
}

const reader = (
  <RsvpProvider controller={controller}>
    <SourceOffset />
  </RsvpProvider>
);
```

With `TMeta = SourceSpan`, every token from a configured tokenizer or `loadTokens()` must carry metadata. Once an item is non-null, its `meta` is a `SourceSpan`. `SourceSpan | undefined` permits metadata-free tokens and an explicitly supplied `TextTokenizer`. These are TypeScript requirements; metadata has no runtime schema validation.

The same fixed metadata type reaches subscriptions, context actions, and selectors. A custom `TokenizerStrategy<T, TMeta>` lets `createRsvpController({ tokenizer })` infer both types. Explicit `<T>` alone leaves metadata as `unknown`, which also permits metadata-free tokens. `createRsvpContext<T, TMeta>()` fixes both types but creates no engine, so it never requires a tokenizer. Metadata may also be a primitive or a union.

Core preserves metadata references through copying and OVP changes without cloning, deep freezing, or interpreting their contents. Keep metadata immutable while in use: in-place mutations do not notify subscribers. OVP-only changes do not rerender selectors that return the same metadata reference. The server snapshot has no current item or metadata. `TextTokenizer` does not supply metadata; source mapping and sentence navigation belong to the application.

### Presentation OVP overrides

A controller `ovpStrategy` is independent of initial tokenizer offsets. `setOvpStrategy()` updates the selected string; upcoming and revisited strings are calculated when selected. Non-string items and `loadTokens()` offsets stay unchanged.

```typescript
controller.setOvpStrategy({ calculate: () => 0 });
controller.setOvpStrategy(undefined); // Restore initial token offsets.
```

The preference survives Stop, reset, and replacement input. Changes preserve position and timing; only a changed selected offset publishes `ovpChanged`. Nonfatal assignment failures preserve the previous strategy and playback. Failures during later selection enter `ERROR`; failures during loading clear the session.

## Errors

Catch controller construction and synchronous command failures at their call site. Configure `onError` for timer and synchronous listener failures:

```typescript
const reader = createRsvpController({
  tokenizer: new TextTokenizer(),
  onError: (error) => console.error(error),
});

try {
  reader.load("Read this text");
  reader.play();
} catch (error) {
  console.error(error);
}
```

Construction and synchronous command failures never invoke `onError`. Without the callback, timer/listener failures reach the host as asynchronous unhandled errors. Listener failures are isolated, so other listeners and queued updates continue. If a command error escapes a listener, it becomes one `ListenerError` with that error as its cause.

Import the same Core error constructors from `@rsvp-engine/react/core` for `instanceof` checks:

| Error family | Meaning |
| --- | --- |
| `EngineError` | Base for command/playback errors; exposes readonly `isFatal` and original `cause`. |
| `MissingTokenizerError` | `load()` needs a configured tokenizer; nonfatal and preserves the session and cached snapshot. Use `loadTokens()` for prepared input. |
| `InvalidTransitionError`, `InvalidInputError`, `IndexOutOfBoundsError`, `EngineDestroyedError` | Rejected commands or input; ordinarily nonfatal. |
| `TokenizationError`, `SessionLoadError` | Fatal input preparation or loading failure. |
| `ItemSelectionError`, `PlaybackSchedulingError` | Fatal selection or scheduling failure. |
| `ListenerError` | Separate `Error` subclass with `eventType` and `cause`; no engine fatality. |

Concrete errors supply default messages and accept optional `ErrorOptionsWithMessage` (`{ message, cause }`) after domain arguments. The base accepts `new EngineError(message, { cause, isFatal })` using `EngineErrorOptions`. Source failures remain in `cause`; a fatal engine-error cause cannot be downgraded by wrapping it.

Nonfatal validation failures preserve playback. Fatal failures cancel advancement and publish `ERROR` before error delivery. Fatal loading clears the session, including selection and progress; fatal playback/navigation preserves the last valid selection and progress. Speed and OVP preferences survive; recover with `reset()`. Snapshots contain no error details, so applications own messages and history.

Callbacks are synchronous; handle rejected promises in asynchronous application work. A failing reporter produces an asynchronously reported `AggregateError` without recursive reporting.

## Lifecycle and server rendering

The application owns the controller. Provider/hook unmounts only detach subscriptions; playback continues. Pause when the reader becomes inactive and call `destroy()` when its owner releases it. Do not create or destroy controllers as render side effects.

Detach consumers and capture required snapshots before destruction. All post-destroy reads, including `getServerSnapshot()`, are unsupported; commands and new subscriptions throw `EngineDestroyedError`. Destruction removes all subscriptions without publishing a final update. Repeated destruction and existing unsubscribe functions are safe; captured snapshots remain unchanged. Cancellation failure still ends the lifetime before throwing.

For SSR, create one controller per request and use matching configuration on server and client. Selectors use the construction-time snapshot with empty content during SSR and initial hydration, then switch to live state. Loading content does not change that server snapshot. A client-only application can load synchronously before rendering to show content on its first render.

## Migration

For upgrades across multiple major versions, apply these steps in version order. Removed APIs have no compatibility aliases.

### React 1 → 2

- Move Core error, constant, and type imports from `@rsvp-engine/react` to `@rsvp-engine/react/core`. Concrete strategies are available from that subpath too, so applications using it can remove their direct Core dependency.
- Replace `DefaultTokenizer<T>` with non-generic `TextTokenizer` and `DefaultTokenizerOptions` with `TextTokenizerOptions`. Remove `nestedTokenize`; every string-array element is split into words. Use `loadTokens()` or a custom tokenizer for generic items or phrases that must stay intact.
- Remove factory `data` and call `load(data)` or `loadTokens(tokens)` after creating the controller. To keep built-in tokenization, explicitly supply Core's `TextTokenizer`; otherwise `load()` throws nonfatal `MissingTokenizerError`. SSR and initial hydration use empty content even when the live controller has been loaded.
- React 2 uses Core 3. Catch all synchronous command failures and use `onError` for timer/listener failures. Replace `snapshot.error`, `clearError()`, `errorOccurred`, and `errorCleared` with application-owned diagnostics and `stateChanged` for fatal transitions.
- Errors use the re-exported `EngineError` family and retain source failures in `cause`. Replace `new InvalidInputError(message)` with `new InvalidInputError({ message })`. Listener exceptions are isolated as `ListenerError`.
- Include `ovpChanged` in exhaustive event handlers and `setOvpStrategy` in custom controller/action implementations. Tokenizer contracts and supplied offsets are unchanged.
- Replace `currentItem.index` with `currentIndex`. Progress uses `currentIndex / totalItems` and reaches `1` only after the final display period.
- Handle empty sessions after fatal loading; recover with `reset()`.
- Capture snapshots and detach consumers before destruction; stop post-destroy reads.

### React 0 → 1

React 1 uses Core 2. Controller ownership and context hooks keep their roles.

| Previous usage | Replacement |
| --- | --- |
| `getSnapshot().snapshot.progress` | `getSnapshot().progress`; snapshots are flat. |
| `({ snapshot }) => snapshot.progress` | `(snapshot) => snapshot.progress` in selectors. |
| `subscribe(() => ...)` | Still valid; use `(snapshot, eventType) => ...` for update details. |
| `Token.delayMultiplier` / `RsvpItem.delayMultiplier` | `durationMultiplier`. |
| `sentenceDelay` / `clauseDelay` / `dashDelay` | `sentenceDurationMultiplier` / `clauseDurationMultiplier` / `dashDurationMultiplier`. |

React 1 adds flat snapshot `error`/`timing` fields and clears stored errors on successful load/reset or `clearError()`; React 2 removes error storage. An expired-item resume publishes `advanced` or `completed`, not `resumed`. Multiplier values and pacing are unchanged.

## License

[MIT](./LICENSE)
