---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Move cached playback and error state into Core with one synchronous subscription. Replace Core `on(...)` calls with `subscribe((snapshot, eventType) => ...)`, and replace `snapshot()` with `getSnapshot()`. Remove `EventEmitter` and the legacy event/payload types, including `itemChange.reason`. Use `started`, `advanced`, and `navigated` to show items, and `completed` to handle completion. Each update carries one `RsvpEventType`; load/reset clear errors in their own notification. Reentrant commands update readable state immediately and queue each snapshot/type pair for ordered delivery. Subscriber exceptions propagate and discard pending notifications.

Core and React clear the last error on successful `load/loadTokens()`, successful `reset()`, or `clearError()`. Clearing error information does not recover the fatal `ERROR` state. Invalid speed/loading input is recorded and still throws. React delegates the live store to Core and preserves construction-time server snapshots. React selectors read the flat snapshot directly: replace `({ snapshot }) => snapshot.progress` with `(snapshot) => snapshot.progress`.
