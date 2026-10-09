# `@rsvp-engine/core`

> A headless, zero-dependency engine for Rapid Serial Visual Presentation (RSVP).

`@rsvp-engine/core` provides deterministic playback state, drift-corrected scheduling, Unicode-aware tokenization, OVP calculation, and typed events without depending on a UI or DOM.

## Features

- Runs in browsers, Node.js, Web Workers, and React Native.
- Ships ESM and CommonJS builds with TypeScript declarations.
- Emits the first item immediately and preserves remaining display time across pause/resume.
- Corrects ordinary timer drift and rebases after severe lag to avoid unreadable catch-up bursts.
- Uses `Intl.Segmenter` when available, with dependency-free fallbacks.
- Supports custom tokenizers, OVP strategies, schedulers, time drivers, and generic item types.

## Installation

```bash
pnpm add @rsvp-engine/core
# npm install @rsvp-engine/core
# yarn add @rsvp-engine/core
```

## Quick start

```typescript
import { RsvpEngine } from "@rsvp-engine/core";

const engine = new RsvpEngine({
  data: "Rapid Serial Visual Presentation powers modern speed reading.",
  wpm: 300,
});

engine.on("itemChange", ({ item, progress, reason }) => {
  console.log(item.value, item.ovpIndex, progress, reason);
});

engine.on("complete", ({ totalItems }) => {
  console.log(`Completed ${totalItems} items`);
});

engine.on("error", ({ error }) => {
  console.error(error);
});

engine.play();
```

The returned function unsubscribes a listener:

```typescript
const unsubscribe = engine.on("stateChange", ({ current }) => console.log(current));
unsubscribe();
```

Asynchronous tokenization stays outside the synchronous engine:

```typescript
const tokens = await tokenizeWithYourService(text);
engine.loadTokens(tokens);
```

## Speed control

Use `engine.setWpm(225)` to set the reading rate or `engine.setMsPerItem(250)` to set the base display duration. The last supplied value is preserved exactly in its unit, including in snapshots; the other unit is derived without additional rounding. Changes affect subsequently scheduled display periods.

## Stopping playback

`stop()` is valid only in `PLAYING` or `PAUSED`; it cancels playback, resets index and progress to zero, and retains loaded data. Other calls emit `InvalidTransitionError` without changing playback.

## Seeking

`seek(index)` requires a finite integer within the loaded token bounds and a state of `PAUSED`, `STOPPED`, or `COMPLETED`. It selects an item in `PAUSED` without starting playback. Invalid indices report `IndexOutOfBoundsError` and preserve playback state, position, progress, and scheduling. Empty input has no valid seek index.

## Migrating API names

Acronyms in class and type names use ordinary PascalCase. The previous names are removed without compatibility aliases:

| Previous name        | Replacement          |
| -------------------- | -------------------- |
| `RSVPEngine`         | `RsvpEngine`         |
| `RSVPEngineOptions`  | `RsvpEngineOptions`  |
| `RSVPItem`           | `RsvpItem`           |
| `RSVPSnapshot`       | `RsvpSnapshot`       |
| `RSVPState`          | `RsvpState`          |
| `RSVPEventType`      | `RsvpEventType`      |
| `RSVPEventMap`       | `RsvpEventMap`       |
| `OVPStrategy`        | `OvpStrategy`        |
| `DefaultOVPStrategy` | `DefaultOvpStrategy` |
| `setSpeed(wpm)`      | `setWpm(wpm)`        |

Update imports, type annotations, constructor calls, and speed commands. `setMsPerItem`, uppercase constants such as `DEFAULT_WPM`, and state values such as `"PLAYING"` retain their names and behavior.

## Contributing

See the [contributor guidelines](./CONTRIBUTING.md) to develop and verify changes locally.

## License

[MIT](./LICENSE)
