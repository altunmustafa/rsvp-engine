# ADR-0008: Own Observable Playback and Error State in Core

- Date: 2026-10-10

## Status

Superseded by [ADR-0009](./0009-typed-store-notifications.md).

## Context

Separate state, item, completion, and error events expose intermediate updates and require adapters to coordinate notifications, cache snapshots, and retain errors. A delta contract would require each consumer to reconstruct full state and distinguish missing values from explicit clearing.

## Decision

We will replace the event API with a synchronous `subscribe(listener)` and cached `getSnapshot()` contract. Core will publish one immutable `RsvpSnapshot<T>` containing playback fields and the last error after each command or scheduled advancement finishes, and only when observable fields change. Each subscriber will receive the same cached snapshot returned by `getSnapshot()`. Error changes will create a new snapshot while unchanged item/error references remain shared.

Core will retain one last error rather than an error history. Successful loading and reset, and explicit `clearError()`, will clear it. Clearing error information will not recover fatal playback state. Existing command throw behavior will remain.

React will delegate the store and commands to Core while preserving external controller ownership, stable actions, selectors, and the construction-time server snapshot. Application-owned errors, logging, and history will stay outside Core.

## Consequences

Consumers receive consistent state without event merging, polling, or per-read allocation. Playback updates allocate fixed-size snapshots and reuse item/error references. Reading full state does not copy loaded tokens.

Removing `on()`, `snapshot()`, `EventEmitter`, and event types is a breaking Core change. Applications that need navigation causes must keep their command context. React's error clearing on successful load/reset is also a behavior change.

Commands from a subscriber update the readable snapshot immediately; notification resumes with the latest state after that callback returns. Superseded snapshots are not replayed. Subscriber exceptions propagate and must be handled by the subscriber; they are not engine failures.
