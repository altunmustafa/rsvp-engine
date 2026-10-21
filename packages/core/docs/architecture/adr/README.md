# Core Architecture Decision Records

Core ADRs use the Michael Nygard sections `Status`, `Context`, `Decision`, and `Consequences`, with the decision date directly below the title. Add a record only for an important, durable architectural decision and assign the next four-digit number.

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-0001](./0001-zero-dependency-headless-core.md) | Accepted | Keep core zero-dependency and headless. |
| [ADR-0002](./0002-drift-corrected-scheduling.md) | Accepted | Correct ordinary timer drift and rebase after large delays. |
| [ADR-0003](./0003-synchronous-tokenization-boundary.md) | Accepted | Keep asynchronous tokenization outside core. |
| [ADR-0004](./0004-dependency-injection-boundaries.md) | Accepted; automatic tokenizer selection superseded by ADR-0022 | Inject time, scheduling, and tokenization at explicit boundaries. |
| [ADR-0005](./0005-unicode-segmentation-fallbacks.md) | Accepted | Prefer platform Unicode segmentation with dependency-free fallbacks. |
| [ADR-0006](./0006-pause-resume-remaining-time.md) | Accepted | Preserve the current item's remaining time across pause and resume. |
| [ADR-0007](./0007-preserve-speed-input-unit.md) | Accepted | Preserve speed inputs in their supplied unit and derive the other representation. |
| [ADR-0008](./0008-unified-observable-store.md) | Superseded by ADR-0009 | Own cached playback/error state and one subscription in Core. |
| [ADR-0009](./0009-typed-store-notifications.md) | Accepted; error policy superseded by ADR-0018 and ADR-0019 | Publish one snapshot and operation type; preserve nested notifications in order. |
| [ADR-0010](./0010-event-sampled-playback-timing.md) | Accepted | Sample playback durations in the existing store using constant-time calculations. |
| [ADR-0011](./0011-retained-session-controls.md) | Accepted; progress superseded by ADR-0013, error retention by ADR-0018 | Retain items across idempotent Stop and allow initial navigation without playback. |
| [ADR-0012](./0012-persistent-ovp-preferences.md) | Accepted | Separate tokenizer offsets from optional per-item presentation OVP overrides. |
| [ADR-0013](./0013-position-based-progress.md) | Accepted | Derive progress from playback position and reach one after the final display period. |
| [ADR-0014](./0014-terminal-destruction.md) | Accepted | End the instance lifetime and clear session buffers; leave post-destroy reads unguarded and unsupported. |
| [ADR-0015](./0015-position-independent-presentation-items.md) | Accepted | Keep sequence position outside source tokens and presentation items. |
| [ADR-0016](./0016-clear-failed-loads.md) | Accepted | Clear session data after fatal loading failures instead of retaining previous content. |
| [ADR-0017](./0017-typed-engine-errors.md) | Accepted | Normalize operation failures into typed engine errors while preserving cause chains and fatality. |
| [ADR-0018](./0018-caller-owned-errors-and-playback-snapshots.md) | Accepted | Throw command failures; report timer and listener failures through onError; publish playback state only. |
| [ADR-0019](./0019-isolated-listener-error-reporting.md) | Accepted | Isolate subscriber failures and report them independently of playback. |
| [ADR-0020](./0020-failure-safe-error-reporting.md) | Accepted | Preserve playback error boundaries when clocks, cancellation, or diagnostic transport fail. |
| [ADR-0021](./0021-consumer-defined-token-metadata.md) | Accepted | Preserve consumer-defined metadata with a fixed type that determines its presence. |
| [ADR-0022](./0022-explicit-content-loading.md) | Accepted | Start empty and load content explicitly; require a tokenizer only for raw loading. |
| [ADR-0023](./0023-text-only-built-in-tokenizer.md) | Accepted | Limit the built-in tokenizer to independently segmented texts; use prepared tokens or custom strategies for other items. |
