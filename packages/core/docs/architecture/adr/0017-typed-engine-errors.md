# ADR-0017: Normalize operation failures into a typed engine error family

- Date: 2026-10-17

## Status

Accepted

## Context

Consumers need to recognize engine errors and distinguish fatal operation failures without parsing messages. Throwing raw dependency errors loses operation context, while unwrapping causes can discard meaningful error layers. Allowing wrappers to downgrade fatality can conceal a session that is no longer safe to use.

## Decision

We will expose one `EngineError` family with dedicated fatal operation types, re-exported by React as the same constructors. Fatal operation boundaries add context and classification while retaining the complete original failure as their cause. Normalization preserves existing engine errors without unwrapping their causes. Fatality is monotonic: a fatal engine-error cause makes its wrapper fatal, including ordinarily nonfatal error types. See the [error contract](../../API-REFERENCE.md#errors).

## Consequences

Consumers can use type checks and cause chains for diagnostics; native and primitive failures are available through `cause` rather than direct propagation. A fatal classification requires explicit recovery with `reset()`. The public error classes and metadata become compatibility commitments, and contextual wrappers can add layers to cause chains.
