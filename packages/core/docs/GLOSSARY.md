# Glossary

Terms used by `@rsvp-engine/core` and its documentation.

**RSVP (Rapid Serial Visual Presentation):** Displays text sequentially, word by word or in chunks, at a fixed focal point.

**Headless / UI-agnostic:** Core state, timing, and data logic that does not render a user interface.

**Zero-dependency:** A package with no external runtime dependencies.

**OVP (Optimal Viewing Position):** The character index used as a word's visual alignment point.

**Tokenizer:** Converts input into `Token` objects and may assign punctuation delays and OVP indices.

**Drift-corrected scheduler:** Adjusts later timer delays to compensate for ordinary event-loop lateness.

**`msPerItem`:** The base display duration of an item, in milliseconds.

**WPM (Words per minute):** Reading speed derived from `msPerItem`.

**State machine:** Enforces valid transitions among `IDLE`, `PLAYING`, `PAUSED`, `STOPPED`, `COMPLETED`, and `ERROR`.
