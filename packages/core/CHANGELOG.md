# Changelog

## 3.0.0

### Major Changes

- [#35](https://github.com/altunmustafa/rsvp-engine/pull/35) [`3f5c234`](https://github.com/altunmustafa/rsvp-engine/commit/3f5c23425ed974c44b57b45e075d5922ed0b2bf5) - Separate error delivery from playback subscriptions. All synchronous command failures now throw to their caller, including invalid controls. Configure the new `onError(error: EngineError | ListenerError)` option for timer and listener failures; without it, these failures are reported asynchronously to the host. Remove uses of `snapshot.error`, `clearError()`, `errorOccurred`, and `errorCleared`. Keep error display and history in application state, and handle `stateChanged` for fatal playback transitions.

  Export `EngineError` as the common base of command and playback errors, with fatal operation subclasses `TokenizationError`, `SessionLoadError`, `ItemSelectionError`, and `PlaybackSchedulingError`. Native errors and primitive thrown values remain intact in `cause`; normalization preserves existing engine errors, and wrapping never downgrades a fatal cause. Use `instanceof` and inspect `cause` instead of relying on the original thrown value or message. Engine-created wrapper messages describe the failed operation.

  Concrete errors provide default messages and accept optional final `ErrorOptionsWithMessage` containing `{ message, cause }`. Replace `new InvalidInputError(message)` with `new InvalidInputError({ message })`. Existing transition and bounds errors retain their domain arguments; `ItemSelectionError` takes and exposes the target `index`. The base accepts `new EngineError(message, { cause, isFatal })` using `EngineErrorOptions`. React re-exports the same constructors and options types through `@rsvp-engine/react/core`.

  Subscriber exceptions no longer interrupt other listeners or queued notifications. Each becomes a separate `ListenerError` with notification `eventType` and original `cause`, independently of engine fatality. Catch a nested command failure inside a listener to handle it locally; if it escapes, `onError` receives one listener error wrapping it. A failing reporter produces an asynchronously reported `AggregateError` without recursive reporting. Callbacks are synchronous; handle rejected promises in asynchronous application work.

  Fatal failures cancel playback and publish `ERROR` before error delivery. Clock and cancellation failures preserve the primary failure and invalidate stale callbacks; fatal timing retains the last successful timestamp with unknown remaining duration. Failed host reporting leaves committed playback and loading intact and finishes notification delivery before a diagnostic aggregate escapes synchronously. An existing command failure keeps priority. Destruction still closes the instance if cancellation fails, then throws that failure.

- [#35](https://github.com/altunmustafa/rsvp-engine/pull/35) [`3f5c234`](https://github.com/altunmustafa/rsvp-engine/commit/3f5c23425ed974c44b57b45e075d5922ed0b2bf5) - Clear session data after fatal tokenization or loading failures instead of retaining previous content, including when preparing the replacement snapshot fails. The `ERROR` snapshot has `currentItem: null`, `currentIndex: 0`, `totalItems: 0`, progress `0`, total duration `0`, and remaining duration `null`. Loading publishes the changed playback state before throwing `TokenizationError` or `SessionLoadError`, preserving the original failure in `cause`.

  Handle empty sessions in error views and call `reset()` before loading again. Speed and OVP preferences survive. Nonfatal token validation and OVP assignment failures preserve the session; fatal playback/navigation failures retain the last valid selection and progress.

- [#38](https://github.com/altunmustafa/rsvp-engine/pull/38) [`1b05e17`](https://github.com/altunmustafa/rsvp-engine/commit/1b05e17f803bd88e2f3657979462cbed279d9407) - Remove constructor/factory `data` and automatic tokenizer selection. Construct an empty engine or controller, then call `load(data)` with an explicitly configured tokenizer, or call `loadTokens(tokens)` without one. To retain built-in text conversion, pass Core's `TextTokenizer` explicitly. Raw loading without a tokenizer throws the exported `MissingTokenizerError` without changing the session or cached snapshot. Initial configuration creates timing and the snapshot once, sampling the clock once without calling public setters. React re-exports that error through `@rsvp-engine/react/core` and retains empty content in its construction-time SSR snapshot; hydration switches to loaded live content afterward.

  Preserve consumer-defined `meta` on tokens and presented items through loading, OVP changes, snapshots, subscriptions, and React selectors. Infer one fixed metadata type from a supplied tokenizer or specify `<T, TMeta>` explicitly, including without a tokenizer. Every token must carry metadata when `TMeta` excludes `undefined`; include `undefined` to permit absence. Metadata defaults to `unknown`, including when only `<T>` is supplied.

  These requirements are enforced by TypeScript; metadata has no runtime schema validation. Metadata stays application-owned and is retained by reference without cloning or deep freezing. Keep it immutable while in use because in-place mutations do not notify subscribers. Default tokenization remains metadata-free; applications provide source spans or other data through custom tokenizers or pre-tokenized input.

- [#35](https://github.com/altunmustafa/rsvp-engine/pull/35) [`3f5c234`](https://github.com/altunmustafa/rsvp-engine/commit/3f5c23425ed974c44b57b45e075d5922ed0b2bf5) - Add an optional engine/controller `ovpStrategy` and `setOvpStrategy()` for per-selected-string presentation overrides without resetting playback timing. Passing `undefined` restores original token offsets. Tokenizer contracts and defaults remain unchanged; pre-tokenized sessions retain supplied offsets. The preference survives Stop, reset, and replacement input. Nonfatal assignment failures preserve the prior strategy and playback; presentation failures during later item selection enter `ERROR`. Strategies must be synchronous and side-effect-free; engine mutation inside tokenizer or OVP callbacks is rejected. Reuse one grapheme segmenter per `DefaultOvpStrategy` instance.

  Core adds `ovpChanged` to the event union: update exhaustive notification handlers. React adds `setOvpStrategy` to controller/actions: update custom implementations. These public type extensions require major releases despite preserving tokenizer compatibility. See README migration sections for Core 2 → 3 and React 1 → 2.

- [#35](https://github.com/altunmustafa/rsvp-engine/pull/35) [`3f5c234`](https://github.com/altunmustafa/rsvp-engine/commit/3f5c23425ed974c44b57b45e075d5922ed0b2bf5) - Derive progress from playback position instead of counting the selected item. Initial playback has progress zero; seek and navigation use `currentIndex / totalItems`; progress reaches one only after the final display period ends. Empty input has progress zero. Fatal playback or navigation failures preserve the last published progress; fatal loading failures clear it to zero. Update progress displays and assertions that counted the selected item before it finished. Core and React README migration sections describe the new behavior.

- [#35](https://github.com/altunmustafa/rsvp-engine/pull/35) [`3f5c234`](https://github.com/altunmustafa/rsvp-engine/commit/3f5c23425ed974c44b57b45e075d5922ed0b2bf5) - Remove `index` from `RsvpItem` and presented item objects. Read position through the engine's `currentIndex` or `snapshot.currentIndex`; an empty session has `currentItem: null` and `currentIndex: 0`. `Token` represents source data with initial offsets, while `RsvpItem` names the same readonly shape after presentation overrides. Tokenizer input contracts and playback timing remain unchanged.

- [#35](https://github.com/altunmustafa/rsvp-engine/pull/35) [`3f5c234`](https://github.com/altunmustafa/rsvp-engine/commit/3f5c23425ed974c44b57b45e075d5922ed0b2bf5) - Clear session buffers, subscriptions, and pending notifications on destruction. Commands and new subscriptions remain guarded with `EngineDestroyedError`. Withdraw post-destroy read guarantees: getters and live/server snapshot reads are unsupported and unguarded. Callers must stop reading the instance, capture any final snapshots before destruction, and detach React consumers before destroying their controller. Repeated destroy and existing unsubscribe functions remain safe; previously captured snapshots remain unchanged.

- [#39](https://github.com/altunmustafa/rsvp-engine/pull/39) [`f3734d0`](https://github.com/altunmustafa/rsvp-engine/commit/f3734d02b2a65946c96726a0e89f109a2f1c2c50) - Replace generic `DefaultTokenizer<T>` and `DefaultTokenizerOptions` with non-generic `TextTokenizer` and `TextTokenizerOptions`. The built-in tokenizer accepts text or a flat array of texts, splits every text independently into words, and concatenates those words in input order. Remove `nestedTokenize`; string arrays no longer preserve phrases as single items. Use `loadTokens()` or a custom tokenizer for generic values, nested input, or indivisible phrases. Invalid runtime input throws `InvalidInputError` directly; through `load()`, it follows the fatal tokenizer-failure contract. Word segmentation, punctuation timing, OVP configuration, and metadata-free output are preserved.

  Expose the complete Core public API through `@rsvp-engine/react/core`, forwarding the installed Core dependency without bundling another copy or importing React. Move Core error, constant, and type imports from the React root to this subpath; the root exports React controller/context bindings and their types only. Applications importing Core APIs exclusively through this subpath need only the React package as their direct RSVP dependency.

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
