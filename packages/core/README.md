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
import { RSVPEngine } from "@rsvp-engine/core";

const engine = new RSVPEngine({
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

## Contributing

See the [contributor guidelines](./CONTRIBUTING.md) to develop and verify changes locally.

## License

[MIT](./LICENSE)
