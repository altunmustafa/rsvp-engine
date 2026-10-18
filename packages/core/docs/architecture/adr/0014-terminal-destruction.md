# ADR-0014: End the instance lifetime on destruction

- Date: 2026-10-14

## Status

Accepted

## Context

Keeping a destroyed instance partly usable blurs its lifetime and retains session buffers. Guarding every read adds checks to ordinary reads and internal calculations even though the application owns that lifetime. Consumers can capture immutable snapshots before releasing the instance.

## Decision

We will make destruction permanently cancel playback, clear session buffers, and stop notification delivery without publishing an update. Commands and new subscriptions will reject further use. Getter and snapshot reads, including React server snapshots, remain unguarded but are unsupported after destruction. Repeated destroy and existing unsubscribe functions remain safe. See the [lifecycle contract](../../API-REFERENCE.md#observable-store).

## Consequences

Owners must stop reads and detach React consumers before destruction; misuse of read paths is not diagnosed automatically. Previously captured snapshots remain unchanged, and the retained engine still holds its last snapshot. This withdraws the post-destroy read guarantee in Core and React. Injected dependencies remain externally owned; destruction cancels playback without destroying shared strategies.
