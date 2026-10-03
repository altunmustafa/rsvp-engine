# Changelog

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
