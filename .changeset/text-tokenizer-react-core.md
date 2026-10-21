---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Replace generic `DefaultTokenizer<T>` and `DefaultTokenizerOptions` with non-generic `TextTokenizer` and `TextTokenizerOptions`. The built-in tokenizer accepts text or a flat array of texts, splits every text independently into words, and concatenates those words in input order. Remove `nestedTokenize`; string arrays no longer preserve phrases as single items. Use `loadTokens()` or a custom tokenizer for generic values, nested input, or indivisible phrases. Invalid runtime input throws `InvalidInputError` directly; through `load()`, it follows the fatal tokenizer-failure contract. Word segmentation, punctuation timing, OVP configuration, and metadata-free output are preserved.

Expose the complete Core public API through `@rsvp-engine/react/core`, forwarding the installed Core dependency without bundling another copy or importing React. Move Core error, constant, and type imports from the React root to this subpath; the root exports React controller/context bindings and their types only. Applications importing Core APIs exclusively through this subpath need only the React package as their direct RSVP dependency.
