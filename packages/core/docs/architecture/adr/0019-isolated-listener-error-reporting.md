# ADR-0019: Isolate listener failures and report them independently

- Date: 2026-10-17

## Status

Accepted

- Supersedes [ADR-0009](./0009-typed-store-notifications.md) for listener failure policy.

## Context

Propagating listener exceptions lets one consumer interrupt other subscribers and discard queued updates. Deferring those exceptions until delivery finishes still exposes them through a command or timer that does not own the consumer's failure. Silently catching them hides application defects, while treating them as engine errors can generate feedback loops and incorrectly inherit fatality from consumer-owned causes.

## Decision

We will catch each synchronous subscriber failure, wrap it in `ListenerError` independently of `EngineError`, and report it through the caller-ownership policy in [ADR-0018](./0018-caller-owned-errors-and-playback-snapshots.md). Delivery will continue with other listeners and queued updates without changing playback or publishing a diagnostic subscription event. Destruction still ends delivery. See the [listener contract](../../API-REFERENCE.md#errors).

## Consequences

One subscriber cannot prevent unrelated consumers from observing committed playback changes. A command failure caught inside a listener is handled locally; if it escapes, it produces one listener report with that error as its cause. Consumers must use error reporting rather than listener exceptions to control delivery. Callback promises remain outside the synchronous store contract, so applications must handle their own asynchronous failures.
