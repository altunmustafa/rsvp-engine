# @rsvp-engine/react

## 1.0.0

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
- Updated dependencies [5ec0e02]
- Updated dependencies [aabc4dd]
- Updated dependencies [7be17d7]
- Updated dependencies [89b91cf]
  - @rsvp-engine/core@2.0.0

## 0.1.2

### Patch Changes

- 66fa040: Clarify that stop() is valid only while playing or paused, retains loaded data, and reports invalid transitions for repeated or completed-session calls. Document the observable error behavior without changing playback.
- Updated dependencies [66fa040]
  - @rsvp-engine/core@1.0.3

## 0.1.1

### Patch Changes

- dc9b6f1: Reject non-integer and non-finite seek indices without changing playback state, selection, or timing. Document seek index requirements and recoverable errors in Core and React.
- Updated dependencies [dc9b6f1]
  - @rsvp-engine/core@1.0.2

## 0.1.0

### Minor Changes

- 411a630: Introduce headless React bindings with an externally owned RSVP controller, typed context, selective subscriptions, and stable playback actions. Support React 18 and 19, server rendering and hydration, and DOM-free integration through ESM, CommonJS, and TypeScript exports.
