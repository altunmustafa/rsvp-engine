# RSVP Engine React (`@rsvp-engine/react`)

## Package Constraints

- Keep production source free of React DOM, browser DOM globals, styling, and host UI.
- Keep runtime dependencies limited to `@rsvp-engine/core` and React's official `use-sync-external-store` selector implementation; keep `react` as a peer dependency.
- Each controller owns one Core engine. React unmount removes subscriptions only; controller playback and lifetime remain with the external owner.
- Keep context creation typed and explicit: use `createRsvpContext<T>()`; do not introduce a global untyped Provider.
- Use React's external-store contract for subscriptions and preserve the construction-time server snapshot.
- Delegate selector memoization and equality handling to `useSyncExternalStoreWithSelector`; do not maintain a render-shared selector cache.
- Preserve cached immutable snapshots and notify subscribers only when observable state changes.
- Keep the package private until the release-preparation stage explicitly removes the publication guard.
- Preserve coverage thresholds in [vitest.config.ts](vitest.config.ts). Follow [CONTRIBUTING.md](CONTRIBUTING.md) for React-specific behavior, SSR, type, and compatibility checks.

## Architecture

Before changing controller ownership, snapshot caching, selectors, or portability boundaries, read the [ADR index](docs/architecture/adr/README.md) and the relevant record. Keep [README.md](README.md) and the [API reference](docs/API-REFERENCE.md) synchronized with public API changes.
