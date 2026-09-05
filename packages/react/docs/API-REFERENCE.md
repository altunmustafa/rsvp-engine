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

## `createRsvpController<T>(options?)`

Creates the single owner of one Core engine. It manages input, playback, timing, cached snapshots, errors, subscriptions, and destruction.

```ts
const controller = createRsvpController({
  data: "one two three",
  wpm: 300,
});
```

The controller remains externally owned. The React Provider never calls `destroy()`.

## `createRsvpContext<T>()`

Creates one isolated, item-type-safe Context bundle:

```tsx
const { RsvpProvider, useRsvpSelector, useRsvpActions, useRsvpController } = createRsvpContext<string>();
```

Create the bundle once at module scope. Every hook must be used under the matching Provider.

### `RsvpProvider`

Makes one externally owned controller available to descendants:

```tsx
<RsvpProvider controller={controller}>
  <Reader />
</RsvpProvider>
```

Changing the `controller` prop moves selector subscriptions to the new controller. Unmounting the Provider does not stop playback or destroy either controller.

### `useRsvpSelector(selector, equalityFn?)`

Selects reactive data from `{ snapshot, error }`:

```tsx
const progress = useRsvpSelector(({ snapshot }) => snapshot.progress);
```

Controller updates run the selector again through React's official `useSyncExternalStoreWithSelector` implementation. The component rerenders only when the selected result differs. The default comparison is `Object.is`.

Selectors that create objects can provide an equality function:

```tsx
const status = useRsvpSelector(
  ({ snapshot }) => ({ state: snapshot.state, wpm: snapshot.wpm }),
  (left, right) => left.state === right.state && left.wpm === right.wpm,
);
```

Selectors must be pure because React may evaluate them more than once.

### `useRsvpActions()`

Returns a stable, frozen object containing:

- `play`, `pause`, `stop`, `seek`, `next`, `previous`, and `reset`
- `load`, `loadTokens`, `setSpeed`, and `setMsPerItem`
- `clearError`

The hook reads Context but does not subscribe to controller state. A controls-only component therefore does not rerender when the current RSVP item changes.

```tsx
const { play, pause } = useRsvpActions();
```

Lifecycle ownership remains explicit, so `destroy` is intentionally absent.

### `useRsvpController()`

Returns the exact controller provided by the matching Provider without subscribing to state:

```tsx
const controller = useRsvpController();
```

This is a low-level escape hatch for integrations, debugging, or building specialized hooks. Prefer `useRsvpSelector` for reactive reads and `useRsvpActions` for commands.

### Lifecycle integration

Provider and consumer unmounts detach React subscriptions without changing playback state or controller lifetime. Applications can pause playback at the lifecycle boundary where a reader session becomes inactive, such as when its route or screen is left. The external owner calls `destroy()` when the controller lifetime ends.

## Public types

- `RsvpController<T>` and `RsvpControllerOptions<T>`
- `RsvpControllerSnapshot<T>` and `RsvpStoreListener`
- `RsvpActions<T>`
- `RsvpProviderProps<T>` and `RsvpContextBundle<T>`
- `RsvpSelector<T, Selected>`, `RsvpEqualityFn<Selected>`, and `UseRsvpSelector<T>`
- Re-exported Core snapshot, item, strategy, scheduler, token, state, and error types

## Portability

Production source imports React, `@rsvp-engine/core`, and React's official `use-sync-external-store` selector implementation only. It does not import React DOM, browser DOM globals, host UI, or styles. React 18 and React 19 are supported peer ranges and checked through root-level consumer fixtures with isolated dependency graphs.
