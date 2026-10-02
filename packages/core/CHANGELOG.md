# Changelog

## 0.1.1

### Patch Changes

- 5fa61c8: Preserve the last speed input exactly in its supplied unit, including fractional values. For example, setting 225 WPM now returns exactly 225 from the getter and snapshot. Explicit millisecond inputs retain their exact duration and derive WPM without additional rounding. Constructor `msPerItem` precedence and playback timing semantics are unchanged.

## 0.1.0

### Minor Changes

- bff614c: Initial release of the headless RSVP engine with drift-corrected playback, Unicode-aware tokenization, configurable OVP calculation, typed events, and dependency-injection boundaries.
