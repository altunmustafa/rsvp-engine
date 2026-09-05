# RSVP Engine React (`@rsvp-engine/react`)

This package adapts Core to React-compatible external-store contracts without owning UI.

## Package Constraints

- Keep production source free of React DOM, browser DOM globals, styling, and host UI.
- Keep runtime dependencies limited to `@rsvp-engine/core` and React's official `use-sync-external-store` selector implementation; keep `react` as a peer dependency.
- Preserve controller ownership: each controller owns one Core engine, while React consumers do not implicitly destroy it.
- Keep context creation typed and explicit: use `createRsvpContext<T>()`; do not introduce a global untyped Provider.
- Use React's external-store contract for subscriptions and preserve the construction-time server snapshot.
- Delegate selector memoization and equality handling to `useSyncExternalStoreWithSelector`; do not maintain a render-shared selector cache.
- Unmount removes React subscriptions only; controller playback and lifetime remain with the external owner.
- Preserve cached immutable snapshots and notify subscribers only when observable state changes.
- Keep the package private until the release-preparation stage explicitly removes the publication guard.
- Maintain at least 95% line and branch coverage with Vitest and TDD.

## Architecture

Read [`docs/architecture/adr/README.md`](docs/architecture/adr/README.md) before changing controller ownership, snapshot caching, or portability boundaries. Keep [`README.md`](README.md) and [`docs/API-REFERENCE.md`](docs/API-REFERENCE.md) synchronized with public API changes.
