# RSVP Engine (`@rsvp-engine/core`)

A zero-dependency, headless TypeScript engine for Rapid Serial Visual Presentation (RSVP), with drift-corrected scheduling, pluggable tokenization, and state-machine flow control.

## Key Commands

- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Coverage:** `pnpm test:coverage`
- **Lint:** `pnpm lint`
- **Format:** `pnpm format`

## Core Architectural Constraints

- **Zero Production Dependencies:** Keep `dependencies` in `package.json` empty.
- **Zero DOM Coupling:** Do not reference `window`, `document`, `HTMLElement`, or browser DOM APIs. Core must run in Node.js, Web Workers, and React Native.
- **Bundle Footprint:** Minified + Gzipped footprint must remain strictly `< 5 KB`.
- **Strict TypeScript:** Keep `"strict": true`, avoid implicit `any`, and use ECMAScript `#privateField` syntax for internal state.
- **Timer Precision:** Main thread drift must remain `< 10ms` over 1 minute of playback.
- **Test Coverage:** Maintain at least 95% line and branch coverage. Use Vitest and TDD for feature changes.

## Documentation

- **Architecture & DI Strategy:** See [docs/architecture/README.md](docs/architecture/README.md)
- **Architecture Decisions:** See [docs/architecture/adr/README.md](docs/architecture/adr/README.md)
- **State Machine Lifecycle:** See [docs/STATE-MACHINE.md](docs/STATE-MACHINE.md)
- **API Reference:** See [docs/API-REFERENCE.md](docs/API-REFERENCE.md)
- **Contribution & TDD Workflow:** See [CONTRIBUTING.md](CONTRIBUTING.md)

## Architecture Decision Records

- Write ADRs only for important, durable decisions whose rationale and consequences future maintainers will need.
- Do not write ADRs for routine refactors, naming, file layout, tests, formatting, tooling, or easily reversible details.
- Follow the project-local `$record-adrs` skill, use its dated Michael Nygard format, store records under `docs/architecture/adr/`, and update the ADR index.
