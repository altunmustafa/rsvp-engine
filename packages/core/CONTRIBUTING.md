# Contributing to `@rsvp-engine/core`

Follow the workspace workflow in [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) and the Core constraints in [`AGENTS.md`](./AGENTS.md). This guide covers only Core-specific practices.

## TypeScript conventions

- Use `interface` for object contracts and `type` for unions and primitives.
- Declare explicit return types on public functions and methods to prevent accidental contract changes.
- Mark immutable fields and properties `readonly`.
- Use ECMAScript `#privateField` syntax for runtime encapsulation.
- Use `PascalCase` for classes and interfaces, `camelCase` for methods and variables, and `UPPER_SNAKE_CASE` for global constants.

## Test strategy

Use Vitest and write the behavior-defining test before its implementation.

### Required coverage

- Cover every valid state transition and invalid transition behavior.
- Use `vi.useFakeTimers()` for time-dependent tests. Simulate late timer callbacks to verify drift recovery.
- Cover tokenizer boundaries, including empty and whitespace-only input, punctuation, and non-string `Token<T>` arrays.
- Restore mocks and timers and remove event listeners after each test.

## Verification

Run from the repository root:

```bash
pnpm --filter @rsvp-engine/core build
pnpm --filter @rsvp-engine/core test
pnpm --filter @rsvp-engine/core test:coverage
pnpm lint
pnpm typecheck
```

Before submitting a change, confirm that:

- the minified and gzipped bundle remains below 5 KB;
- line and branch coverage remain at least 95%;
- timing tests keep simulated one-minute drift below 10 ms;
- public interfaces, classes, and methods have TSDoc comments.

## Packaging

`tsup` produces CommonJS, ESM, and declaration outputs. Before a release, verify these manifest entries:

- `main`: `./dist/index.cjs` (CJS)
- `module`: `./dist/index.js` (ESM)
- `types`: `./dist/index.d.ts` (Types)
- `files`: an explicit allowlist of consumer-facing artifacts; exclude source, tests, caches, and repository-only `docs/` content.

Use the root contribution guide for Changesets, commit, pull request, and release rules.
