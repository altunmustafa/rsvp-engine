# `@rsvp-engine/core`

> A headless, zero-dependency engine for Rapid Serial Visual Presentation (RSVP).

`@rsvp-engine/core` provides deterministic playback state, drift-corrected scheduling, Unicode-aware tokenization, OVP calculation, and a cached observable store without depending on a UI or DOM.

## Features

- Runs in browsers, Node.js, Web Workers, and React Native.
- Ships ESM and CommonJS builds with TypeScript declarations.
- Presents the first item immediately and preserves remaining display time across pause/resume.
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

const unsubscribe = engine.subscribe((snapshot, eventType) => {
  console.log(eventType, snapshot.currentItem?.value, snapshot.progress, snapshot.state);
  if (snapshot.error) console.error(snapshot.error);
});

engine.play();
```

Call `unsubscribe()` to detach the listener and `engine.destroy()` when the reader's owner releases it. The engine owns playback; applications own rendering, input acquisition, and storage.

## Configuration and commands

All constructor options are optional. `data: T | T[]` supplies input; `wpm` defaults to `DEFAULT_WPM`. `msPerItem` takes precedence over `wpm`. Inject `tokenizer`, `scheduler`, or `timeDriver` to replace the defaults.

Speed inputs must be finite and within the exported `MIN_WPM`/`MAX_WPM` or `MIN_MS_PER_ITEM`/`MAX_MS_PER_ITEM` limits. Fractional values are supported. The supplied unit is preserved exactly; the other is derived as `60_000 / value` without rounding. Changes affect future periods, preserving the running or paused item's remaining time.

| Command | Behavior |
| --- | --- |
| `play()` | Starts from `IDLE`, resumes `PAUSED`, or replays `STOPPED`/`COMPLETED` from index `0`. Requires nonempty input. |
| `pause()` | Valid only in `PLAYING`; retains the item and its remaining display time. |
| `stop()` | Returns `PLAYING`/`PAUSED`/`COMPLETED` to `STOPPED` at index and progress `0`, retaining data. No-op in `IDLE`/`STOPPED`; invalid in `ERROR`. |
| `seek(index)` | Selects an in-bounds finite integer index from `IDLE`, `PAUSED`, `STOPPED`, or `COMPLETED`, entering `PAUSED` without playback. |
| `next()` / `previous()` | Moves one item while `PAUSED`; does nothing at an endpoint. |
| `load(data)` / `loadTokens(tokens)` | Replaces input and returns to `IDLE`; rejected in `PLAYING` or `ERROR`. |
| `setWpm(wpm)` / `setMsPerItem(ms)` | Changes the base rate or display interval. |
| `clearError()` | Clears error information without changing playback state. |
| `reset()` | Valid only in `ERROR`; clears data and returns to empty `IDLE`. |
| `destroy()` | Permanently cancels playback and subscriptions; safe to repeat. |

Stop retains items without retokenizing, restores full remaining duration, and preserves existing errors. Repeated Stop and Stop in `IDLE`, including empty input, preserve the cached snapshot and do not notify. Initial seek gives the selected item its full display period without scheduling; `play()` continues from that position. Invalid seek indices preserve position, progress, and scheduling. Empty input has no valid seek index. Pause before seeking during playback; pause or stop before replacing playing data; reset before replacing data in `ERROR`.

## Snapshots and subscriptions

`getSnapshot()` reads the cached, immutable `RsvpSnapshot<T>`. Its reference stays stable until observable state changes. `subscribe((snapshot, eventType) => ...)` delivers changes synchronously after playback and scheduling are ready; it does not call the listener on subscription, so read the initial snapshot explicitly.

| Field | Meaning |
| --- | --- |
| `state` | `IDLE`, `PLAYING`, `PAUSED`, `STOPPED`, `COMPLETED`, or fatal `ERROR`. |
| `currentIndex` / `currentItem` | Selected or presented index and item; the item is `null` for empty input. |
| `progress` / `totalItems` | Presented-token fraction and token count, not elapsed time or linguistic word count. |
| `wpm` / `msPerItem` | Base rate and interval before the item's `durationMultiplier`. |
| `timing` | Frozen duration sample described below. |
| `error` | Last error, or `null`. |

Progress is `0` in `IDLE` and `STOPPED`, and counts the selected item after navigation, including initial seek. It reaches `1` when the final item is selected or presented. That item still needs its display period; detect completion with `state === "COMPLETED"`.

Each update carries one `RsvpEventType`, describing its operation rather than individual fields:

| Type                             | Operation                                               |
| -------------------------------- | ------------------------------------------------------- |
| `loaded` / `reset`               | Replace input or recover from a fatal error.            |
| `started` / `resumed`            | Start/replay or continue a paused item.                 |
| `paused` / `stopped`             | Pause or return to the beginning.                       |
| `advanced` / `navigated`         | Advance during playback or select an item manually.     |
| `completed`                      | Finish the final item's display period.                 |
| `speedChanged`                   | Change observable speed.                                |
| `errorOccurred` / `errorCleared` | Record a failure or explicitly clear error information. |

No-ops do not notify. Failed commands use `errorOccurred`; successful load/reset clear errors in their own notification. Nested commands queue notifications in order; use the callback's supplied snapshot for its event. Listeners must handle their own exceptions, which otherwise interrupt delivery and propagate.

Invalid controls record an error without throwing or changing usable playback. Invalid speed/loading inputs are recorded and still throw; unexpected tokenizer or scheduler failures enter `ERROR`. Constructor failures throw. Errors clear on `clearError()`, successful loading, or successful reset; clearing error information alone does not recover `ERROR`.

After destruction, the last snapshot remains readable; commands and new subscriptions throw `EngineDestroyedError`.

## Duration estimates

Read `getSnapshot().timing`:

| Field                 | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `totalDurationMs`     | Fresh playback estimate at the selected speed, including all item multipliers. |
| `remainingDurationMs` | Retained current-item remainder plus future periods; `null` in fatal `ERROR`.  |
| `sampledAtMs`         | Timestamp in the engine's `TimeDriver` clock, not necessarily Unix time.       |

Samples update on loading, playback/navigation changes, and effective speed changes. Reads, no-ops, and nonfatal error changes do not resample. Pause freezes the remainder; navigation gives the selected item a full period. In `IDLE` and `STOPPED`, remaining equals total; empty input and completion have zero remaining time. Speed increases can make remaining exceed total because the active item's older period is retained. Estimates exclude pauses and future host delays.

Core adds no countdown timer. For a live countdown, share the engine's `TimeDriver`, subtract `now() - sampledAtMs` only while `PLAYING`, and clamp to zero. Rebase on each new sample; use engine state for completion. Loading prepares O(n) suffix sums; subsequent estimates take O(1).

## Tokenization and custom strategies

`DefaultTokenizer` uses `Intl.Segmenter` when available, falling back to whitespace boundaries. Array elements are individual tokens unless `nestedTokenize: true`; non-string values are individual items. `DefaultOvpStrategy` selects a grapheme-aware UTF-16 offset within a string token, not its location in the source passage.

Tokens contain `value: T`, a non-negative integer `ovpIndex` within string bounds, and a positive finite `durationMultiplier`. Display duration is `msPerItem * durationMultiplier`. Configure punctuation with `sentenceDurationMultiplier`, `clauseDurationMultiplier`, and `dashDurationMultiplier`; inject `ovpStrategy` to change the viewing position.

| Strategy | Responsibility and contract |
| --- | --- |
| `TokenizerStrategy<T>` | Converts input synchronously: `tokenize(input: T \| T[]): Token<T>[]`. Prepare asynchronous tokens outside Core and pass them to `loadTokens()`. |
| `OvpStrategy` | Chooses the viewing offset: `calculate(text: string): number`. |
| `SchedulerStrategy` | Runs delayed work with `schedule(task, delayMs)` and `cancel()`. Optional `getDeadline(): number \| null` supplies the effective deadline in the engine clock; otherwise accounting is nominal. |
| `TimeDriver` | Supplies `now()`, `setTimeout(callback, ms)`, and `clearTimeout(handle)`. Use a coherent clock with custom scheduling. |

The default `DriftCorrectedScheduler` corrects ordinary lag and rebases after severe lag. `SystemTimeDriver` uses `performance.now()` when available, otherwise `Date.now()`, and requires host timers. Resume of an expired item advances or completes immediately instead of scheduling a zero delay.

## Migration

### Core 1 → 2

Apply both migrations below when upgrading from Core 1 to Core 2; old APIs have no compatibility aliases. New integrations use the API described above.

#### Migrating subscriptions

Replace `on(...)` with `subscribe((snapshot, eventType) => ...)`, and `snapshot()` with `getSnapshot()`. `error` is part of the flat snapshot and clears on successful load/reset as well as `clearError()`. `EventEmitter`, event maps, legacy payload types, and `itemChange.reason` are removed. Use the notification types above; callbacks receive a complete snapshot instead of separate event payloads.

#### Migrating duration multipliers

Update custom tokens, tokenizer output, item reads, and `DefaultTokenizer` options:

| Previous name                                        | Replacement                  |
| ---------------------------------------------------- | ---------------------------- |
| `Token.delayMultiplier` / `RsvpItem.delayMultiplier` | `durationMultiplier`         |
| `sentenceDelay`                                      | `sentenceDurationMultiplier` |
| `clauseDelay`                                        | `clauseDurationMultiplier`   |
| `dashDelay`                                          | `dashDurationMultiplier`     |

The old names are removed without aliases. Multipliers remain positive finite numbers; an item's display duration is `msPerItem * durationMultiplier`. Defaults and playback pacing are unchanged.

### Core 0 → 1

#### Migrating API names

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

Update imports, type annotations, constructor calls, and speed commands. `setMsPerItem`, uppercase constants such as `DEFAULT_WPM`, and state values such as `"PLAYING"` retain their names and behavior. A direct upgrade from Core 0 to Core 2 also requires the Core 2 migrations; event maps and legacy payload types are removed there.

## License

[MIT](./LICENSE)
