# ADR-0009: Publish Typed Atomic Store Notifications

- Date: 2026-10-10

## Status

Accepted; supersedes [ADR-0008](./0008-unified-observable-store.md).

## Context

A full snapshot supports independent reads and React selectors, but cannot distinguish initial presentation, timed advancement, and manual navigation without application-side comparisons. Per-field change arrays describe data differences rather than these operations; separate events would fragment one operation into multiple notifications.

## Decision

We will retain Core ownership of cached immutable playback/error state and replace the old event API with `getSnapshot()` and `subscribe((snapshot, eventType) => ...)`. Each observable update will carry one `RsvpEventType`, determined by the operation's outcome, after playback and scheduling finish. The [API reference](../../API-REFERENCE.md#notification-types) defines the event types. Failed operations will publish `errorOccurred` instead of success. Unchanged observable state will not notify.

Core will retain one last error, cleared by successful loading/reset or `clearError()`, with no error history. Clearing it will not recover fatal playback state. Existing command throw behavior will remain. React will delegate this contract and retain its construction-time server snapshot.

Nested commands will update `getSnapshot()` immediately and queue each immutable snapshot/type pair. Core will finish the active notification before delivering queued updates in order. Destruction will stop delivery. Subscriber exceptions will propagate, discard pending notifications, and never become engine errors; original command exceptions will take precedence.

## Consequences

Applications can route display work by operation without reconstructing state or retaining prior snapshots. The public snapshot remains independently readable and does not store transient event metadata. Removing the legacy API and changing React selector/error behavior remain breaking changes.

Ordinary updates add a string argument without allocating a queue entry. Only nested commands allocate notification pairs; their delivery requires a queue and preserves intermediate states. During nested delivery, a callback's supplied snapshot can precede the latest `getSnapshot()` value, so event handlers must use the supplied snapshot.
