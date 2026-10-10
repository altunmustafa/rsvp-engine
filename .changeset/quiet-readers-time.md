---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Rename `Token.delayMultiplier` and `RsvpItem.delayMultiplier` to `durationMultiplier`, and rename `DefaultTokenizer` options `sentenceDelay`, `clauseDelay`, and `dashDelay` to `sentenceDurationMultiplier`, `clauseDurationMultiplier`, and `dashDurationMultiplier`. Update custom tokens, tokenizers, and item reads in Core and React. The old names are removed without aliases; multiplier values, defaults, and playback pacing are unchanged.

Expose immutable playback duration samples through `getSnapshot().timing` and the existing subscription, with total duration, remaining duration, and a timestamp in the engine's clock. Preparation takes O(n) time and storage on load; duration updates use O(1) calculations and add no countdown timer. React exposes the same samples and preserves cached server snapshots.

Use effective scheduler deadlines to preserve pause/resume timing after drift correction. Custom schedulers may implement `getDeadline()`; existing schedulers retain nominal accounting. Resume advances an expired item without scheduling zero delays, producing one `advanced` or `completed` notification instead of `resumed`.
