# ADR-0001: Own Core Through a Cached External Store

- Date: 2026-09-02

## Status

Accepted

## Context

Core returns a new snapshot object on every call and does not emit one event covering every mutation. React external-store consumers require referentially stable snapshots between changes and complete change notification. Changing Core would reopen an accepted package boundary, while polling would add latency and unnecessary work. Exposing the raw engine would also allow mutations that bypass adapter bookkeeping.

Controller lifetime must remain independent from any one React component so playback can outlive a mounted consumer and work in React Native or non-React orchestration.

## Decision

We will create a React-package controller that owns exactly one Core engine, wraps every mutation, observes Core events, and exposes an immutable cached `{ snapshot, error }` value. The controller will notify subscribers synchronously only when that observable value changes and will retain a separate construction-time snapshot for server rendering.

Controller creation and destruction will remain explicit. React bindings may subscribe to an externally supplied controller but will not own or implicitly destroy it. The raw Core engine will not be exposed.

## Consequences

React-compatible consumers receive stable snapshots for silent mutations and event-driven playback without changing Core. Playback and controller lifetime can span component mounts, but the creator must call `destroy()` explicitly. The adapter duplicates a small amount of mutation and event coordination and must track future Core API additions deliberately.
