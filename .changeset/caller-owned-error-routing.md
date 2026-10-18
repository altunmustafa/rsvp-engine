---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Separate error delivery from playback subscriptions. All synchronous command failures now throw to their caller, including invalid controls. Configure the new `onError(error: EngineError | ListenerError)` option for timer and listener failures; without it, these failures are reported asynchronously to the host. Remove uses of `snapshot.error`, `clearError()`, `errorOccurred`, and `errorCleared`. Keep error display and history in application state, and handle `stateChanged` for fatal playback transitions.

Export `EngineError` as the common base of command and playback errors, with fatal operation subclasses `TokenizationError`, `SessionLoadError`, `ItemSelectionError`, and `PlaybackSchedulingError`. Native errors and primitive thrown values remain intact in `cause`; normalization preserves existing engine errors, and wrapping never downgrades a fatal cause. Use `instanceof` and inspect `cause` instead of relying on the original thrown value or message. Engine-created wrapper messages describe the failed operation.

Concrete errors provide default messages and accept optional final `ErrorOptionsWithMessage` containing `{ message, cause }`. Replace `new InvalidInputError(message)` with `new InvalidInputError({ message })`. Existing transition and bounds errors retain their domain arguments; `ItemSelectionError` takes and exposes the target `index`. The base accepts `new EngineError(message, { cause, isFatal })` using `EngineErrorOptions`. React re-exports the same constructors and options types.

Subscriber exceptions no longer interrupt other listeners or queued notifications. Each becomes a separate `ListenerError` with notification `eventType` and original `cause`, independently of engine fatality. Catch a nested command failure inside a listener to handle it locally; if it escapes, `onError` receives one listener error wrapping it. A failing reporter produces an asynchronously reported `AggregateError` without recursive reporting. Callbacks are synchronous; handle rejected promises in asynchronous application work.

Fatal failures cancel playback and publish `ERROR` before error delivery. Clock and cancellation failures preserve the primary failure and invalidate stale callbacks; fatal timing retains the last successful timestamp with unknown remaining duration. Failed host reporting leaves committed playback and loading intact and finishes notification delivery before a diagnostic aggregate escapes synchronously. An existing command failure keeps priority. Destruction still closes the instance if cancellation fails, then throws that failure.
