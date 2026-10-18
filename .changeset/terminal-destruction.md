---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Clear session buffers, subscriptions, and pending notifications on destruction. Commands and new subscriptions remain guarded with `EngineDestroyedError`. Withdraw post-destroy read guarantees: getters and live/server snapshot reads are unsupported and unguarded. Callers must stop reading the instance, capture any final snapshots before destruction, and detach React consumers before destroying their controller. Repeated destroy and existing unsubscribe functions remain safe; previously captured snapshots remain unchanged.
