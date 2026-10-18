# ADR-0018: Route errors by caller ownership and publish playback state only

- Date: 2026-10-18

## Status

Accepted

- Supersedes [ADR-0009](./0009-typed-store-notifications.md) for error storage, error events, and command throw policy.
- Supersedes [ADR-0011](./0011-retained-session-controls.md) for error retention.
- Supersedes [React ADR-0003](../../../../react/docs/architecture/adr/0003-delegate-core-observable-store.md) for error storage.

## Context

Combining command exceptions and error-bearing snapshots gives consumers multiple channels for the same failure. Storing diagnostics also publishes updates when playback is unchanged. Synchronous commands have a waiting caller; timer tasks and uncaught subscriber exceptions do not. A listener-specific reporting callback would add another channel instead of resolving that distinction.

## Decision

We will throw synchronous command failures to their caller and report timer and listener failures through one optional `onError` callback. Without that callback, failures without a caller will reach the host asynchronously. Reporter failures will not re-enter the callback. Listener isolation follows [ADR-0019](./0019-isolated-listener-error-reporting.md).

Snapshots and subscriptions will contain playback state only. Fatal failures will still cancel playback, enter `ERROR`, and publish the observable state change before error delivery. Errors retain the [typed error contract](./0017-typed-engine-errors.md) without being stored in the engine. React will delegate the same contract; see the [API reference](../../API-REFERENCE.md#errors).

## Consequences

Consumers catch command failures and configure one callback for failures without a caller. Applications own error display, history, and clearing, so late subscribers cannot recover past error details from the engine. Removing snapshot errors, the clearing command, and error events, and making all synchronous command failures throw require a major release.
