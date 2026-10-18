# ADR-0012: Separate initial and presentation OVP strategies

- Date: 2026-10-13

## Status

Accepted

## Context

OVP offsets are calculated during tokenization. Reloading to change them resets playback. Eagerly recalculating long sessions adds synchronous work, while requiring tokenizer management methods would break custom implementations. Offsets supplied through `loadTokens()` belong to their producer.

## Decision

We will retain tokenizer OVP calculation and add an independent, optional engine presentation strategy. `setOvpStrategy()` updates the selected string; other words are calculated as they become selected. Removing the override restores retained token offsets. The preference survives Stop, reset, and replacement input; manual offsets remain unchanged.

Assignment preserves playback timing and retains the previous strategy on failure. Nonfatal assignment failures preserve playback; presentation failures during later selection enter `ERROR`. Calculations must be synchronous and side-effect-free. See the [API contract](../../API-REFERENCE.md#runtime-ovp-preferences).

## Consequences

Custom tokenizer contracts and defaults remain intact. Selection and assignment use constant staging storage, but failures in future words cannot be detected at assignment. Enabling both strategies calculates a word at tokenization and presentation. Applications own injected-instance sharing; synchronous custom work can delay playback.
