# ADR-0023: Limit built-in tokenization to text

- Date: 2026-10-21

## Status

Accepted

## Context

Explicit loading lets applications play prepared tokens without configuring a tokenizer. The built-in tokenizer also wrapped arbitrary values, preserved array items, or recursively tokenized them, combining text segmentation with generic item conversion. A single text strategy gives applications a clearer choice between splitting text and preparing their own playback items.

## Decision

We will provide a non-generic `TextTokenizer` for strings and flat arrays of strings. Each text is segmented independently and its words are appended in order. Empty text contributes no tokens. Generic values, nested arrays, and invalid runtime input are rejected. Punctuation timing, initial OVP configuration, Unicode segmentation, and metadata-free output retain their text behavior.

Applications use prepared tokens or a custom tokenizer for other content. The generic engine and tokenizer interface remain available for those integrations.

## Consequences

Consumers migrate from the former generic built-in tokenizer and remove its recursive-tokenization option. String arrays always represent texts to split; consumers preserving phrases as individual playback items prepare tokens instead. Invalid input follows the existing tokenizer-failure boundary when loaded through the engine.
