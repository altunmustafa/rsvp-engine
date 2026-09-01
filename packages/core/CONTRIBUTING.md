# Contributing to `@rsvp-engine/core`

Follow the workspace workflow in [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md). This guide contains only Core-specific practices.

## Understand the Design

Core must remain dependency-free, platform-neutral, deterministic, and compact. Before changing a long-lived boundary, read the relevant documentation:

- [Architecture and dependency injection](docs/architecture/README.md)
- [State machine lifecycle](docs/STATE-MACHINE.md)
- [Public API reference](docs/API-REFERENCE.md)
- [Architecture decisions](docs/architecture/adr/README.md)

Quality thresholds, package outputs, and supported runtimes are encoded in package configuration and validation scripts. Treat those files as the source of truth; the root `pnpm verify` command runs the applicable gates.

## Write TypeScript Deliberately

- Use `interface` for object contracts and `type` for unions and primitives.
- Declare explicit return types on public functions and methods.
- Mark immutable fields and properties `readonly`.
- Use ECMAScript `#privateField` syntax for runtime encapsulation.
- Document public interfaces, classes, and methods with TSDoc.

## Test Behavior

- Write the behavior-defining test before its implementation.
- Cover valid state transitions and invalid-transition behavior.
- Use fake timers for scheduling tests, including delayed callbacks and drift recovery.
- Cover tokenizer boundaries such as empty input, whitespace, punctuation, and non-string tokens.
- Restore timers and mocks and remove event listeners after each test.
