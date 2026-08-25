# ADR-0004: Use Explicit Time, Scheduling, and Tokenization Boundaries

- Date: 2026-08-19

## Status

Accepted

## Context

Playback depends on host clocks and timers, scheduling policy, and input tokenization. Hard-coding these concerns would make tests nondeterministic and prevent use in non-standard runtimes or specialized applications.

## Decision

Define `TimeDriver` as the clock and timer boundary, `SchedulerStrategy` as the delayed-work boundary, and `TokenizerStrategy` as the input-conversion boundary. Provide dependency-free defaults and compose the default scheduler with the engine's selected time driver. Allow hosts to inject replacements independently.

## Consequences

Tests can use deterministic fakes, and hosts can replace timing or tokenization without forking the engine. A host that supplies both a custom scheduler and time driver is responsible for keeping their time semantics coherent.
