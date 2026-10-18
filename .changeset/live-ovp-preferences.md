---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Add an optional engine/controller `ovpStrategy` and `setOvpStrategy()` for per-selected-string presentation overrides without resetting playback timing. Passing `undefined` restores original token offsets. Tokenizer contracts and defaults remain unchanged; pre-tokenized sessions retain supplied offsets. The preference survives Stop, reset, and replacement input. Nonfatal assignment failures preserve the prior strategy and playback; presentation failures during later item selection enter `ERROR`. Strategies must be synchronous and side-effect-free; engine mutation inside tokenizer or OVP callbacks is rejected. Reuse one grapheme segmenter per `DefaultOvpStrategy` instance.

Core adds `ovpChanged` to the event union: update exhaustive notification handlers. React adds `setOvpStrategy` to controller/actions: update custom implementations. These public type extensions require major releases despite preserving tokenizer compatibility. See README migration sections for Core 2 → 3 and React 1 → 2.
