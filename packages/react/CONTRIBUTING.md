# Contributing to `@rsvp-engine/react`

Follow the repository-wide [`CONTRIBUTING.md`](../../CONTRIBUTING.md), including its mandatory TDD workflow.

Keep the adapter headless and externally owned: production source must not import React DOM, access browser globals, render host UI, or destroy a controller during component unmount. Add or update tests before implementation when behavior changes, including SSR and generic type coverage where relevant.

Run package verification from the repository root:

```sh
pnpm verify --filter=@rsvp-engine/react
```

The `verify` script includes the package's checks and the isolated React 18 and React 19 compatibility fixtures.

The [TypeScript consumer fixture](../../fixtures/typescript-consumer/README.md) checks public declarations under NodeNext and bundler resolution with library checking enabled. Keep source API type tests in this package and package-consumer tests in the fixture.
