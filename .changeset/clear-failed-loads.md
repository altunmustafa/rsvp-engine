---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Clear session data after fatal tokenization or loading failures instead of retaining previous content, including when preparing the replacement snapshot fails. The `ERROR` snapshot has `currentItem: null`, `currentIndex: 0`, `totalItems: 0`, progress `0`, total duration `0`, and remaining duration `null`. Loading publishes the changed playback state before throwing `TokenizationError` or `SessionLoadError`, preserving the original failure in `cause`.

Handle empty sessions in error views and call `reset()` before loading again. Speed and OVP preferences survive. Nonfatal token validation and OVP assignment failures preserve the session; fatal playback/navigation failures retain the last valid selection and progress.
