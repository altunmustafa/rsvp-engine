---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Remove `index` from `RsvpItem` and presented item objects. Read position through the engine's `currentIndex` or `snapshot.currentIndex`; an empty session has `currentItem: null` and `currentIndex: 0`. `Token` represents source data with initial offsets, while `RsvpItem` names the same readonly shape after presentation overrides. Tokenizer input contracts and playback timing remain unchanged.
