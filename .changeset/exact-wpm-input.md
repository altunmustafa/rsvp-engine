---
"@rsvp-engine/core": patch
---

Preserve the last speed input exactly in its supplied unit, including fractional values. For example, setting 225 WPM now returns exactly 225 from the getter and snapshot. Explicit millisecond inputs retain their exact duration and derive WPM without additional rounding. Constructor `msPerItem` precedence and playback timing semantics are unchanged.
