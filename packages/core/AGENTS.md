# RSVP Engine (`@rsvp-engine/core`)

The zero-dependency, headless TypeScript RSVP engine. It owns state, scheduling, tokenization, and OVP calculation.

## Core Architectural Constraints

- **Zero Production Dependencies:** Keep `dependencies` in `package.json` empty.
- **Zero DOM Coupling:** Do not reference `window`, `document`, `HTMLElement`, or browser DOM APIs. Core must run in Node.js, Web Workers, and React Native.
- **Bundle Footprint:** Minified + Gzipped footprint must remain strictly `< 5 KB`.
- **Strict TypeScript:** Keep `"strict": true`, avoid implicit `any`, and use ECMAScript `#privateField` syntax for internal state.
- **Timer Precision:** Main thread drift must remain `< 10ms` over 1 minute of playback.
- **Test Coverage:** Maintain at least 95% line and branch coverage. Use Vitest and TDD for feature changes.

## Documentation

- Before changing module boundaries, dependency injection, scheduling design, or portability constraints, read [Architecture & DI Strategy](docs/architecture/README.md).
- Before revisiting an accepted architecture decision, read the [ADR index](docs/architecture/adr/README.md) and the relevant record.
- Before changing states, transitions, or playback lifecycle, read [State Machine Lifecycle](docs/STATE-MACHINE.md).
- Before changing public exports or contracts, read the [API Reference](docs/API-REFERENCE.md).
- For TypeScript conventions, TDD, verification, and packaging, read [Core Contribution Guide](CONTRIBUTING.md).

## Architecture Decision Records

For important, durable architecture decisions—not routine or easily reversible changes—use the project-local `$record-adrs` skill.
