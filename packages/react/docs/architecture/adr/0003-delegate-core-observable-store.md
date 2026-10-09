# ADR-0003: Delegate the Observable Store to Core

- Date: 2026-10-10

## Status

Accepted; supersedes [ADR-0001](./0001-own-core-with-a-cached-external-store.md).

## Context

Core now owns the cached playback/error snapshot and unified change notification described in [Core ADR-0008](../../../../core/docs/architecture/adr/0008-unified-observable-store.md). Keeping a second store in the React controller would duplicate state comparison, error ownership, and notification work.

## Decision

We will delegate controller commands, live snapshots, subscriptions, and destruction directly to the owned Core engine. `RsvpControllerSnapshot<T>` will alias Core's `RsvpSnapshot<T>`. The controller will retain its construction-time snapshot for SSR and keep actions stable and safe to pass without binding.

External ownership and selector behavior will remain unchanged. Core's error policy will apply to React: successful loading/reset and `clearError()` clear the last error.

## Consequences

React no longer combines events, stores errors, or compares playback fields. Selector input changes from a wrapper to the flat `RsvpSnapshot<T>`. Successful loading/reset clears errors that previously persisted, so consumers relying on sticky errors must keep that history in the application.
