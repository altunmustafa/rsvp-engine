# ADR-0002: Use Context-Bound Selectors and Actions

- Date: 2026-09-02

## Status

Accepted

## Context

RSVP playback can update the observable snapshot several times per second. A hook that returns the entire snapshot and every command makes controls and status components rerender for unrelated item changes. Controller-parameter hooks also duplicate the access path once Context is the required integration boundary. Selectors need memoization, custom equality, server snapshots, and concurrent rendering safety.

The viable API alternatives were to keep direct controller hooks, expose one all-in-one Context hook, or split Context access into selective reads, stable commands, and a low-level controller escape hatch. Selector integration could use a custom cache, vendor React's algorithm, or depend on React's official external-store selector package.

## Decision

We will make `createRsvpContext<T>()` the source of all React consumer hooks. It will return `RsvpProvider`, `useRsvpSelector`, `useRsvpActions`, and `useRsvpController`.

`useRsvpSelector` will subscribe through the controller's external-store contract and delegate selector memoization and equality handling to `useSyncExternalStoreWithSelector` from `use-sync-external-store`. It will rerender only when its selected result changes according to `Object.is` or a supplied equality function. `useRsvpActions` and `useRsvpController` will read Context without subscribing to snapshot changes. Direct public `useRsvp(controller)` and `useRsvpSnapshot(controller)` hooks will not be exposed.

## Consequences

Components can subscribe only to the state they render, while controls avoid item-change rerenders. One typed Context factory consistently binds the item type and controller identity. Consumers must define and export their Context bundle before rendering, and selectors must remain pure. Concurrent selector behavior follows React's maintained implementation, while the package gains one official runtime dependency and corresponding development-time type declarations. `useRsvpController` remains an intentionally low-level escape hatch.
