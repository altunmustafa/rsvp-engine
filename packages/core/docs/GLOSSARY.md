# Glossary

Terms used by `@rsvp-engine/core` and its documentation.

**RSVP (Rapid Serial Visual Presentation):** Displays text sequentially, word by word or in chunks, at a fixed focal point.

**Headless / UI-agnostic:** Core state, timing, and data logic that does not render a user interface.

**Zero-dependency:** A package with no external runtime dependencies.

**OVP (Optimal Viewing Position):** The character index used as a word's visual alignment point.

**Tokenizer:** Converts input into `Token` objects and may assign punctuation duration multipliers and OVP indices.

**Drift-corrected scheduler:** Adjusts later timer delays to compensate for ordinary event-loop lateness.

**`msPerItem`:** The base display duration of an item, in milliseconds.

**`durationMultiplier`:** A positive finite factor applied to `msPerItem` to determine an item's display duration.

**WPM (Words per minute):** The configured reading rate. An explicit WPM input is preserved exactly; when the speed is set in `msPerItem`, WPM is derived as `60_000 / msPerItem`.

**State machine:** Enforces valid transitions among `IDLE`, `PLAYING`, `PAUSED`, `STOPPED`, `COMPLETED`, and `ERROR`.
