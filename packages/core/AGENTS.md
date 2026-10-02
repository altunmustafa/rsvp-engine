# RSVP Engine (`@rsvp-engine/core`)

## Core Architectural Constraints

- Keep Core platform-neutral: no `window`, `document`, `HTMLElement`, or browser DOM APIs. It must run in Node.js, Web Workers, and React Native.
- Preserve the bundle budget enforced by [check-bundle-size.js](scripts/check-bundle-size.js) and coverage thresholds in [vitest.config.ts](vitest.config.ts).
- When changing scheduling, preserve drift correction and recovery under delayed callbacks as tested in [scheduler tests](src/scheduler/drift-corrected-scheduler.test.ts). The simulated lag target is not a wall-clock guarantee under arbitrary main-thread blocking.

## Documentation

- Before changing module boundaries, dependency injection, scheduling design, or portability constraints, read [Architecture & DI Strategy](docs/architecture/README.md).
- Before revisiting an accepted architecture decision, read the [ADR index](docs/architecture/adr/README.md) and the relevant record.
- Before changing states, transitions, or playback lifecycle, read [State Machine Lifecycle](docs/STATE-MACHINE.md).
- Before changing public exports or contracts, read the [API Reference](docs/API-REFERENCE.md).
- For Core-specific TypeScript conventions and behavioral tests, follow the [Core Contribution Guide](CONTRIBUTING.md).
