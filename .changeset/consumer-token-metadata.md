---
"@rsvp-engine/core": major
"@rsvp-engine/react": major
---

Remove constructor/factory `data` and automatic tokenizer selection. Construct an empty engine or controller, then call `load(data)` with an explicitly configured tokenizer, or call `loadTokens(tokens)` without one. To retain built-in conversion, pass Core's `DefaultTokenizer` explicitly. Raw loading without a tokenizer throws the exported `MissingTokenizerError` without changing the session or cached snapshot. Initial configuration creates timing and the snapshot once, sampling the clock once without calling public setters. React re-exports that error and retains empty content in its construction-time SSR snapshot; hydration switches to loaded live content afterward.

Preserve consumer-defined `meta` on tokens and presented items through loading, OVP changes, snapshots, subscriptions, and React selectors. Infer one fixed metadata type from a supplied tokenizer or specify `<T, TMeta>` explicitly, including without a tokenizer. Every token must carry metadata when `TMeta` excludes `undefined`; include `undefined` to permit absence. Metadata defaults to `unknown`, including when only `<T>` is supplied.

These requirements are enforced by TypeScript; metadata has no runtime schema validation. Metadata stays application-owned and is retained by reference without cloning or deep freezing. Keep it immutable while in use because in-place mutations do not notify subscribers. Default tokenization remains metadata-free; applications provide source spans or other data through custom tokenizers or pre-tokenized input.
