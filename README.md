# RSVP Engine

RSVP Engine is a TypeScript monorepo for building Rapid Serial Visual Presentation readers.

`@rsvp-engine/core` provides a headless engine for playback state, scheduling, tokenization, and optimal viewing position calculation. See the [Core README](packages/core/README.md) for installation, features, and API usage.

## Packages

- [`packages/core`](packages/core/README.md): published headless engine

## Examples

- [`examples`](examples/): runnable workspace examples

## Develop

The root [`package.json`](package.json) defines the supported development tooling. Install the workspace from the repository root:

```bash
pnpm install
```

Run the complete quality suite with:

```bash
pnpm verify
```

Workspace tasks are orchestrated with Turborepo. Use pnpm filters for focused package or example commands while iterating.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, test-first development, Changesets, branch naming, commit conventions, and pull requests. Package-specific contributor guides cover only practices that differ from the workspace workflow.
