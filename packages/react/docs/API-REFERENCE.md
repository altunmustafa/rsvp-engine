# React API Reference

The package has two layers:

1. `createRsvpController` creates and owns the RSVP engine.
2. `createRsvpContext` connects that controller to a React tree and returns three typed hooks.

```text
createRsvpController
        │
        ▼
   RsvpProvider
        │
        ├── useRsvpSelector   reactive state selection
        ├── useRsvpActions    stable commands
        └── useRsvpController non-reactive escape hatch
```

## `createRsvpController<T = string, TMeta = unknown>(options?)`

Creates the single owner of one empty Core engine. It delegates commands, cached snapshots, errors, and subscriptions to Core and retains the construction-time server snapshot with empty content.

```ts
import { TextTokenizer } from "@rsvp-engine/react/core";

const controller = createRsvpController({
  tokenizer: new TextTokenizer(),
  wpm: 300,
});
controller.load("one two three");
```

`RsvpControllerOptions<T, TMeta>` aliases Core's optional engine configuration, including `tokenizer`, `ovpStrategy`, and `onError`. Metadata is inferred from a supplied tokenizer or specified explicitly; `<T>` alone leaves it as `unknown`. A tokenizer is optional for any metadata type; `loadTokens()` works without one, while `load()` throws nonfatal `MissingTokenizerError` and preserves the session and snapshot. No tokenizer is selected automatically. See [Core options](../../core/docs/API-REFERENCE.md#options). The controller remains externally owned; the React Provider never calls `destroy()`.

`getServerSnapshot()` retains empty content even after loading. SSR and initial hydration select that snapshot, then React switches to live state. Use matching configuration on server and client. A client-only application can synchronously load before rendering and show content on its first render.

## `createRsvpContext<T = string, TMeta = unknown>()`

Creates one isolated Context bundle with fixed item and metadata types:

```tsx
const { RsvpProvider, useRsvpSelector, useRsvpActions, useRsvpController } = createRsvpContext<string>();
```

Create the bundle once at module scope. Every hook must be used under the matching Provider. The context creates no engine and never requires a tokenizer; its Provider requires a controller with compatible item and metadata types.

### `RsvpProvider`

Makes one externally owned controller available to descendants:

```tsx
<RsvpProvider controller={controller}>
  <Reader />
</RsvpProvider>
```

Changing the `controller` prop moves selector subscriptions to the new controller. Unmounting the Provider does not stop playback or destroy either controller.

### `useRsvpSelector(selector, equalityFn?)`

Selects reactive data from the flat `RsvpSnapshot<T, TMeta>`:

```tsx
const progress = useRsvpSelector((snapshot) => snapshot.progress);
```

Controller updates run the selector again through React's official `useSyncExternalStoreWithSelector` implementation. The component rerenders only when the selected result differs. The default comparison is `Object.is`.

Selectors that create objects can provide an equality function:

```tsx
const status = useRsvpSelector(
  (snapshot) => ({ state: snapshot.state, wpm: snapshot.wpm }),
  (left, right) => left.state === right.state && left.wpm === right.wpm,
);
```

Selectors must be pure because React may evaluate them more than once.

Select `snapshot.timing` for the frozen `RsvpTiming` sample, or `snapshot.timing.remainingDurationMs` for a nullable remaining duration. The controller delegates samples to Core without adding a timer; its server snapshot retains the construction-time sample. See [Core duration estimates](../../core/docs/API-REFERENCE.md#duration-estimates) for sampling, clock, and countdown semantics.

`snapshot.currentItem` is an `RsvpItem<T, TMeta> | null` containing the presentation value, effective OVP, duration multiplier, and application metadata. Its `meta` is required unless `TMeta` accepts `undefined`. Source `Token<T, TMeta>` values supplied to `loadTokens()` retain their initial offsets. Items carry no sequence position; select `snapshot.currentIndex` for it.

Metadata remains typed through subscriptions, Provider props, actions, and selectors. Use `createRsvpContext<T, TMeta>()` with a compatible controller. Metadata selectors use the usual equality check: OVP-only changes retain the metadata reference. `getServerSnapshot()` has no current item or metadata. See the [metadata example](../README.md#application-metadata) and [Core ownership contract](../../core/docs/API-REFERENCE.md#application-metadata).

### `useRsvpActions()`

Returns a stable, frozen object containing:

- `play`, `pause`, `stop`, `seek`, `next`, `previous`, and `reset`
- `load`, `loadTokens`, `setWpm`, `setMsPerItem`, and `setOvpStrategy`

The hook reads Context but does not subscribe to controller state. A controls-only component therefore does not rerender when the current RSVP item changes.

```tsx
const { play, pause } = useRsvpActions();
```

Lifecycle ownership remains explicit, so `destroy` is intentionally absent. `loadTokens(tokens: Token<T, TMeta>[])` requires metadata compatible with the context's fixed type; omission is permitted only when that type accepts `undefined`.

`seek()` requires a finite integer in `[0, totalItems)` and `IDLE`, `PAUSED`, `STOPPED`, or `COMPLETED`. It enters `PAUSED` without scheduling, gives the selected item a full display period, and allows choosing a position before the first playback. Progress is `currentIndex / totalItems`, excluding the selected item; `play()` continues from it. Progress reaches `1` after the final display period ends, and fatal playback or navigation errors retain the last published progress. Invalid indices throw `IndexOutOfBoundsError` before checking state without changing selection, progress, or scheduling. Empty input has no valid seek index. Pause active playback before seeking.

Commands use Core's [error handling](#error-handling): catch synchronous failures, and configure `onError` for timer and listener failures.

`stop()` returns `PLAYING`, `PAUSED`, or `COMPLETED` to `STOPPED`, resetting index and progress to zero and restoring full remaining duration while retaining items. It never retokenizes or starts playback. Stop in `IDLE`, including empty input, and repeated Stop in `STOPPED` preserve the cached snapshot without notifying or resampling timing. Stop in fatal `ERROR` throws `InvalidTransitionError`; recovery still requires `reset()`. See the [Core Stop state matrix](../../core/docs/STATE-MACHINE.md#stop-behavior).

The same speed commands are available on the controller. `setWpm(225)` preserves `225` exactly in `snapshot.wpm`; `setMsPerItem(ms)` preserves the interval and derives WPM from it. Fractional inputs are supported. Repeating an unchanged value does not notify subscribers. Switching input units can change the derived WPM even when the interval is unchanged, which is an observable snapshot update. See [Core speed semantics](../../core/docs/API-REFERENCE.md#data-and-speed-methods).

An optional controller `ovpStrategy` overrides presentation independently of tokenization. `setOvpStrategy(strategy: OvpStrategy | undefined)` updates the selected string immediately; upcoming or revisited strings are calculated when selected. Passing `undefined` restores initial token offsets. The preference survives Stop, reset, and replacement input; `loadTokens()` offsets remain unchanged. Nonfatal assignment failures preserve the prior strategy and playback timing; later selection failures enter `ERROR`. Changed selected offsets publish `ovpChanged`. React retains its construction-time server snapshot. See [Core runtime OVP preferences](../../core/docs/API-REFERENCE.md#runtime-ovp-preferences) for validation and calculation costs.

### `useRsvpController()`

Returns the exact controller provided by the matching Provider without subscribing to state:

```tsx
const controller = useRsvpController();
```

This is a low-level escape hatch for integrations, debugging, or building specialized hooks. Prefer `useRsvpSelector` for reactive reads and `useRsvpActions` for commands.

### Direct subscriptions

Controller subscribers receive `(snapshot, eventType)` directly from Core. `RsvpEventType` describes the operation behind each update; selectors continue to read only the snapshot. See the [Core notification types](../../core/docs/API-REFERENCE.md#notification-types) for event meanings and delivery rules.

### Error handling

Snapshots contain playback state only; applications own error messages and history. Synchronous controller failures throw normalized `EngineError` instances without invoking `onError`. Timer and listener failures use the optional `onError(error: EngineError | ListenerError)` callback. Rejected nonfatal commands preserve the cached snapshot without notifying; fatal failures publish the changed `ERROR` state as `stateChanged` before error delivery.

Synchronous subscriber failures are isolated as `ListenerError extends Error`, with notification `eventType` and original `cause`, independently of engine fatality. Other listeners and queued updates continue. A nested command failure caught inside a listener is handled locally; if it escapes, it produces one listener report wrapping that error.

Without `onError`, failures reach the host asynchronously through a microtask or injected timer. A failing reporter produces an asynchronous `AggregateError` without recursive reporting. Returned promises are not observed. If host reporting cannot be scheduled, delivery finishes before a diagnostic aggregate escapes synchronously; committed playback remains intact and an existing command failure retains priority.

`@rsvp-engine/react/core` re-exports Core's error constructors, including `EngineError`, `ListenerError`, `MissingTokenizerError`, and the fatal operation types `TokenizationError`, `SessionLoadError`, `ItemSelectionError`, and `PlaybackSchedulingError`. The same constructors support `instanceof` checks across packages. Normalization preserves engine errors and complete cause chains; a fatal cause cannot be downgraded. Concrete errors accept optional final `ErrorOptionsWithMessage` containing `{ message, cause }`; the base accepts `EngineErrorOptions` with `cause` and `isFatal`. See [Core error constructors and reporting](../../core/docs/API-REFERENCE.md#errors) for signatures and classification.

Fatal loading failures publish an empty `ERROR` session before throwing: no current item or loaded tokens, index and progress `0`, total duration `0`, and remaining duration `null`. Speed and OVP preferences survive. Nonfatal input validation and OVP assignment failures preserve the session; fatal playback/navigation failures retain the last valid selection and progress. Recovery requires `reset()`.

Clock and cancellation failures are fatal. Fatal timing retains the last successful `sampledAtMs` without reading the clock again; secondary cleanup failures cannot replace the primary error. Destruction still ends the controller lifetime if cancellation fails, then throws that failure without notifying.

### Lifecycle integration

Provider and consumer unmounts detach React subscriptions without changing playback state or controller lifetime. Applications can pause playback at the lifecycle boundary where a reader session becomes inactive, such as when its route or screen is left. The external owner calls `destroy()` when the controller lifetime ends.

Detach consumers before destroying their controller. Destroy cancels playback, clears session buffers, and stops notification delivery without publishing an update. Subsequent commands and new subscriptions throw `EngineDestroyedError`. Callers must stop reading the controller; post-destroy snapshot reads are unsupported and unguarded, with no guaranteed results. Repeated destroy and existing unsubscribe functions remain safe. Capture any required snapshots before destruction; previously captured snapshots remain unchanged.

## Public types

- `RsvpController<T, TMeta>` and `RsvpControllerOptions<T, TMeta>`
- `RsvpControllerSnapshot<T, TMeta>`
- `RsvpActions<T, TMeta>`
- `RsvpProviderProps<T, TMeta>` and `RsvpContextBundle<T, TMeta>`
- `RsvpSelector<T, Selected, TMeta>`, `RsvpEqualityFn<Selected>`, and `UseRsvpSelector<T, TMeta>` Core's complete public API is exported from `@rsvp-engine/react/core`, including `RsvpStoreListener`, `RsvpEventType`, snapshot, item, strategy, scheduler, token, state, and error types. The subpath forwards the installed Core dependency without bundling a copy or importing React; the root exports only the React APIs above.

## Portability

Production source imports React, `@rsvp-engine/core`, and React's official `use-sync-external-store` selector implementation only. It does not import React DOM, browser DOM globals, host UI, or styles. React 18 and React 19 are supported peer ranges and checked through root-level consumer fixtures with isolated dependency graphs.
