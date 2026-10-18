# ADR-0020: Preserve playback error boundaries when reporting fails

- Date: 2026-10-18

## Status

Accepted

## Context

[ADR-0018](./0018-caller-owned-errors-and-playback-snapshots.md) defines error routing, while [ADR-0010](./0010-event-sampled-playback-timing.md) defines playback timing samples. Both need a failure policy when their dependencies break: a failed clock or scheduler can prevent publication of the failure it caused, and cancellation can replace the original error with a cleanup exception. Publication also invokes consumer code and diagnostic transport; classifying every exception there as an engine failure can clear a successful load or corrupt committed playback.

## Decision

We will classify failures at the boundary that owns them: engine operations, subscriber callbacks, or host error reporting. Publication prepares and delivers a snapshot together, but diagnostic transport failures bypass engine error handling and preserve committed playback. Delivery finishes other subscribers and queued updates before propagating transport failures; an existing engine failure retains priority.

Fatal reporting will use the last successful timing sample without reading a failed clock, preserve the primary error if cleanup also fails, and invalidate callbacks before cancellation. Clock and cancellation failures are fatal. Loading snapshot failures follow [ADR-0016](./0016-clear-failed-loads.md), and destruction completes cleanup even when cancellation fails. See the [error contract](../../API-REFERENCE.md#errors).

## Consequences

Failure publication does not depend on the failed clock or successful cancellation. A pending stale timer cannot advance playback, and reporting failures cannot invalidate successful loading. Fatal timing identifies the last successful sample rather than the failure time. Diagnostic aggregates retain reporting causes and remain internal types; if host reporting cannot be scheduled, synchronous propagation is the last available path.
