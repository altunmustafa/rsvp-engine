# ADR-0022: Separate configuration from explicit content loading

- Date: 2026-10-21

## Status

Accepted

- Supersedes [ADR-0004](./0004-dependency-injection-boundaries.md) for automatic tokenizer selection.

## Context

An engine can play prepared tokens without converting raw input. Requiring a tokenizer merely because metadata is required couples these independent capabilities. Selecting a metadata-free tokenizer automatically also complicates the generic implementation: the engine cannot prove that its fallback satisfies an arbitrary metadata type. The metadata contract is described in [ADR-0021](./0021-consumer-defined-token-metadata.md). Constructor content loading combines configuration with session replacement and makes initial behavior depend on the input path.

## Decision

We will construct empty engines and controllers using configuration only. Tokenizers remain optional for every metadata type and are retained exactly as supplied, without a fallback. Raw loading requires a tokenizer; prepared-token loading does not. Missing raw-input conversion throws a dedicated nonfatal error before tokenization begins, preserving the session and snapshot. Metadata presence still follows its declared type.

React retains the empty construction-time server snapshot. Applications load content explicitly, including synchronously before a client-only render. We will not add a separate initial-content API for server rendering. See the [Core API](../../API-REFERENCE.md#options) and [React lifecycle contract](../../../../react/README.md#lifecycle-and-server-rendering).

## Consequences

The generic engine stores only its declared tokenizer strategy and needs no assertion to select a default. Prepared-token applications need no unused tokenizer. Raw-input consumers must select a compatible tokenizer explicitly and move constructor content into a loading call. SSR and initial hydration show empty reader content before switching to loaded live state. Timing and scheduling defaults remain available, and the built-in tokenizer retains its existing name and input support.
