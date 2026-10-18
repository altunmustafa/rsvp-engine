# ADR-0016: Clear sessions after fatal loading failures

- Date: 2026-10-16

## Status

Accepted

## Context

Retaining the previous session when replacement presentation fails requires staging before installation or rollback afterward. The engine enters `ERROR` either way, and recovery requires a reset that clears the session. Retaining that data therefore preserves a display without enabling playback recovery.

## Decision

We will validate replacement tokens before installation, then install source tokens and prepare the first item through the shared selection operation. Fatal tokenization or loading failures clear session data, enter `ERROR`, and throw a typed engine error after publishing the changed state. Speed and OVP preferences survive. Nonfatal validation failures preserve the session; fatal playback or navigation failures retain the last valid selection.

## Consequences

Loading needs no rollback and cannot expose a previous selection paired with replacement tokens after failure. Consumers must handle an empty error session and zero progress. This changes the Core snapshot contract also exposed by React. Recovery still requires `reset()`; see the [error policy](../../API-REFERENCE.md#errors).
