# ADR-0013: Derive progress from playback position

- Date: 2026-10-14

## Status

Accepted

- Supersedes [ADR-0011](./0011-retained-session-controls.md) for progress calculation.

## Context

Counting the selected item makes progress reach one before playback completes and requires a separate flag to represent the initial position. Counting actual reading history would require additional state and ambiguous rules for skipped or revisited items.

## Decision

We will derive progress from `currentIndex / totalItems`, return zero for empty input, and return one after the final display period ends. Fatal playback and navigation errors preserve the last published progress; fatal loading failures clear the session under [ADR-0016](./0016-clear-failed-loads.md). Seeking changes position, not reading history.

## Consequences

The engine needs no presentation-counting flag or additional counter. Progress stays below one while the final item is selected. This changes public progress values in Core and React; consumers must update their expectations. See the [API contract](../../API-REFERENCE.md#state-getters).
