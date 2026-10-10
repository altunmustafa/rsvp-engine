# ADR-0011: Retain sessions across Stop and initial navigation

- Date: 2026-10-10

## Status

Accepted

## Context

Stop only accepts playing or paused sessions, so a consumer must reload completed content to return to the beginning without playback. That repeats tokenization and replaces item identities. Repeated Stop also records an error. Initial navigation requires a consumer to start playback first, even when it only wants to select an item.

Keeping the restrictions preserves strict command preconditions but duplicates state handling in consumers. Adding a separate rewind command would grow the API while leaving conventional Stop behavior surprising. Temporarily playing and pausing to enable navigation would schedule work and publish playback that the consumer did not request.

## Decision

We will make Stop a no-op in `IDLE`, including empty input, and `STOPPED`. From `PLAYING`, `PAUSED`, or `COMPLETED`, it will enter `STOPPED`, cancel pending playback, and reset index and progress to zero while retaining items and restoring full remaining duration. Stop will preserve existing errors. It remains invalid in fatal `ERROR`; only `reset()` recovers that state.

We will permit in-bounds finite integer seek from nonempty `IDLE`, entering `PAUSED` without scheduling playback. The selected item receives a full display period and counts toward position-based progress. Play continues from that selection. Existing paused/stopped/completed seek paths remain valid; `PLAYING` still requires explicit pause, and `ERROR` remains unavailable. Next and previous remain paused-only commands.

We will retain the [typed store contract](./0009-typed-store-notifications.md): observable Stop and seek publish one `stopped` or `navigated` update after the operation finishes. No-op Stop preserves snapshot and [timing](./0010-event-sampled-playback-timing.md) references and publishes nothing. Invalid indices are checked before transitions and preserve the prior position and timing.

## Consequences

Consumers can reset completed content or select an initial position without retokenizing or issuing transient playback commands. Repeated Stop introduces no new error, timer, or notification. React inherits the behavior through its Core-backed controller and retains its construction-time server snapshot.

Consumers that guarded Stop or used load after completion can simplify their integration. Stop in `IDLE` retains `IDLE` rather than entering `STOPPED`. Initial seek can produce nonzero progress, including progress one on the last item, before playback starts; completion still requires `COMPLETED`. Stop does not clear previously recorded errors, and fatal recovery remains explicit.
