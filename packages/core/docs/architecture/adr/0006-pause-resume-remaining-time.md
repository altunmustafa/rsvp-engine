# ADR-0006: Preserve Remaining Item Time Across Pause and Resume

- Date: 2026-08-19

## Status

Accepted

## Context

Restarting an item's full interval after every pause makes repeated pauses extend reading time, while immediately advancing on resume can cut the current item short. The engine needs deterministic pause behavior independent of host UI.

## Decision

Record the active item's deadline with `TimeDriver`. On pause, store the non-negative difference between that deadline and the current time, then cancel scheduling. On resume, schedule the current item for exactly the stored remainder without emitting another `itemChange`. Manual navigation starts a fresh full interval for the selected item.

## Consequences

Pause and resume preserve the current item's intended display duration and avoid duplicate presentation events. The time driver used for deadline accounting must be coherent with scheduling, and speed changes while paused affect subsequent intervals rather than the already captured remainder.
