# ADR-0003: Keep Asynchronous Tokenization Outside Core

- Date: 2026-08-19

## Status

Accepted

## Context

Remote NLP, AI tokenization, and other asynchronous sources introduce loading states, cancellation, retries, and host-specific failure policies. Bringing those concerns into the playback engine would make construction and state transitions asynchronous and less deterministic.

## Decision

Keep `TokenizerStrategy.tokenize()` synchronous. Perform asynchronous tokenization in the host, then pass completed tokens to `loadTokens()`.

## Consequences

Core construction, playback, tests, and snapshots remain synchronous and deterministic. Hosts that use asynchronous tokenization must own its lifecycle, errors, and cancellation before loading the result into the engine.
