---
"@rsvp-engine/core": major
---

Normalize acronym casing in public API names and rename `setSpeed` to `setWpm`. This is a breaking change: the old names are removed without deprecated aliases.

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
