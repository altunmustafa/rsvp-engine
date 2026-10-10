# Changelog

## 2.0.0

### Major Changes

- aabc4dd: Rename `Token.delayMultiplier` and `RsvpItem.delayMultiplier` to `durationMultiplier`, and rename `DefaultTokenizer` options `sentenceDelay`, `clauseDelay`, and `dashDelay` to `sentenceDurationMultiplier`, `clauseDurationMultiplier`, and `dashDurationMultiplier`. Update custom tokens, tokenizers, and item reads in Core and React. The old names are removed without aliases; multiplier values, defaults, and playback pacing are unchanged.

  Expose immutable playback duration samples through `getSnapshot().timing` and the existing subscription, with total duration, remaining duration, and a timestamp in the engine's clock. Preparation takes O(n) time and storage on load; duration updates use O(1) calculations and add no countdown timer. React exposes the same samples and preserves cached server snapshots.

  Use effective scheduler deadlines to preserve pause/resume timing after drift correction. Custom schedulers may implement `getDeadline()`; existing schedulers retain nominal accounting. Resume advances an expired item without scheduling zero delays, producing one `advanced` or `completed` notification instead of `resumed`.

- 89b91cf: Move cached playback and error state into Core with one synchronous subscription. Replace Core `on(...)` calls with `subscribe((snapshot, eventType) => ...)`, and replace `snapshot()` with `getSnapshot()`. Remove `EventEmitter` and the legacy event/payload types, including `itemChange.reason`. Use `started`, `advanced`, and `navigated` to show items, and `completed` to handle completion. Each update carries one `RsvpEventType`; load/reset clear errors in their own notification. Reentrant commands update readable state immediately and queue each snapshot/type pair for ordered delivery. Subscriber exceptions propagate and discard pending notifications.

  Core and React clear the last error on successful `load/loadTokens()`, successful `reset()`, or `clearError()`. Clearing error information does not recover the fatal `ERROR` state. Invalid speed/loading input is recorded and still throws. React delegates the live store to Core and preserves construction-time server snapshots. React selectors read the flat snapshot directly: replace `({ snapshot }) => snapshot.progress` with `(snapshot) => snapshot.progress`.

### Minor Changes

- 7be17d7: Make Stop a no-op in `IDLE` and `STOPPED`, including empty input, and allow Stop from `COMPLETED` to return to `STOPPED` at index and progress zero. Retain loaded items without retokenizing, restore full remaining duration, and preserve existing errors. Repeated Stop preserves the cached snapshot and timing without notifying. Stop remains invalid in fatal `ERROR`; use `reset()` to recover.

  Allow in-bounds finite integer seek from nonempty `IDLE`, entering `PAUSED` without starting playback. The selected item receives its full display period; progress counts the selection and Play continues from it. Active playback still requires explicit pause before seek. Core and React consumers can remove completed-session reloads and transient play/pause initialization used solely to enable navigation.

### Patch Changes

- 5ec0e02: Make the packaged READMEs self-contained with playback, subscription, timing, and error guidance instead of links to unshipped documentation. Consolidate migration instructions by major version: Core 1 for earlier API naming, and Core 2 / React 1 for flat snapshots, subscriptions, and duration multipliers.

## 1.0.3

### Patch Changes

- 66fa040: Clarify that stop() is valid only while playing or paused, retains loaded data, and reports invalid transitions for repeated or completed-session calls. Document the observable error behavior without changing playback.

## 1.0.2

### Patch Changes

- dc9b6f1: Reject non-integer and non-finite seek indices without changing playback state, selection, or timing. Document seek index requirements and recoverable errors in Core and React.

## 1.0.1

### Patch Changes

- b130c26: Fix TypeScript declaration compatibility for NodeNext consumers. Bundle declarations into separate ESM and CommonJS entry points so package-internal extensionless imports no longer cause type-resolution errors.

## 1.0.0

### Major Changes

- 07044f1: Normalize acronym casing in public API names and rename `setSpeed` to `setWpm`. This is a breaking change: the old names are removed without deprecated aliases.

  Update imports and type annotations using these mappings:

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

  Replace `engine.setSpeed(wpm)` with `engine.setWpm(wpm)`. The React controller and `useRsvpActions()` also use `setWpm`, and their re-exported Core types use the new casing.

  `setMsPerItem`, speed precision, playback behavior, uppercase constants, and state string values are unchanged.

## 0.1.1

### Patch Changes

- 5fa61c8: Preserve the last speed input exactly in its supplied unit, including fractional values. For example, setting 225 WPM now returns exactly 225 from the getter and snapshot. Explicit millisecond inputs retain their exact duration and derive WPM without additional rounding. Constructor `msPerItem` precedence and playback timing semantics are unchanged.

## 0.1.0

### Minor Changes

- bff614c: Initial release of the headless RSVP engine with drift-corrected playback, Unicode-aware tokenization, configurable OVP calculation, typed events, and dependency-injection boundaries.
