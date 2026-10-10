---
"@rsvp-engine/core": minor
"@rsvp-engine/react": minor
---

Make Stop a no-op in `IDLE` and `STOPPED`, including empty input, and allow Stop from `COMPLETED` to return to `STOPPED` at index and progress zero. Retain loaded items without retokenizing, restore full remaining duration, and preserve existing errors. Repeated Stop preserves the cached snapshot and timing without notifying. Stop remains invalid in fatal `ERROR`; use `reset()` to recover.

Allow in-bounds finite integer seek from nonempty `IDLE`, entering `PAUSED` without starting playback. The selected item receives its full display period; progress counts the selection and Play continues from it. Active playback still requires explicit pause before seek. Core and React consumers can remove completed-session reloads and transient play/pause initialization used solely to enable navigation.
