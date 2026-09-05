# `@rsvp-engine/react`

Headless, context-first React bindings for `@rsvp-engine/core`. The package provides an externally owned controller and typed Context hooks without importing React DOM, browser globals, host UI, or styles.

The package remains private until its release-preparation stage.

## Basic usage

Create one typed Context bundle and reuse it throughout the application:

```tsx
import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController({
  data: "Read this text",
  wpm: 300,
});

const { RsvpProvider, useRsvpSelector, useRsvpActions } = createRsvpContext<string>();

function Word() {
  const word = useRsvpSelector(({ snapshot }) => snapshot.currentItem?.value);

  return <strong>{word}</strong>;
}

function Controls() {
  const { play, pause, stop } = useRsvpActions();

  return (
    <>
      <button onClick={play}>Play</button>
      <button onClick={pause}>Pause</button>
      <button onClick={stop}>Stop</button>
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

`useRsvpSelector` delegates concurrent-safe selection to React's official external-store implementation and rerenders its component only when the selected result changes. `useRsvpActions` does not subscribe to controller state, so controls do not rerender on every RSVP item.

## Lifecycle ownership

The controller is externally owned. The Provider exposes it to descendants, while Provider and hook unmounts only remove React subscriptions. Playback state and controller lifetime remain under application control.

Map controller operations to application lifecycle boundaries: pause playback when the reader session becomes inactive, and call `controller.destroy()` when the application-level owner permanently releases the controller.

## Server rendering

Selectors read the controller's immutable construction-time snapshot during server rendering and switch to its live snapshot during hydration. Create controllers per request for request-specific data; do not share mutable controllers between server requests.

See [`docs/API-REFERENCE.md`](docs/API-REFERENCE.md) for the complete API and [`docs/architecture/adr/README.md`](docs/architecture/adr/README.md) for design decisions.
