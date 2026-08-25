# ADR-0002: Correct Timer Drift and Rebase After Large Delays

- Date: 2026-08-19

## Status

Accepted

## Context

Repeated JavaScript timers accumulate event-loop delay and gradually reduce effective playback speed. Scheduling immediate catch-up work after a large delay can flash RSVP items too quickly to read.

## Decision

Track an ideal deadline across consecutive schedules and subtract ordinary drift from the next delay. Keep a readability floor of half the requested interval. When drift is at least one full interval, abandon the old timeline and rebase from the current time instead of issuing a catch-up burst. Cancellation resets the timeline.

## Consequences

Ordinary timer lag does not accumulate across playback, while long host suspensions recover without unreadable bursts. A rebased session prioritizes readable pacing over catching up to elapsed wall-clock time.
