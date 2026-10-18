# RSVP Engine

## Development and Verification

- Use pnpm from the repository root so workspace resolution and task orchestration apply.
- Follow [CONTRIBUTING.md](CONTRIBUTING.md) and the affected package's contributor guide for TDD, verification, Changesets, and delivery.
- Core API or behavior changes require checking downstream packages, examples, and compatibility fixtures and running workspace-wide `pnpm verify`.

## Dependency Boundaries

- Core must remain free of production dependencies, including other workspace packages. Adapters may depend on Core, but must not import from sibling adapters.
- Use `workspace:*` for internal dependencies and the catalog in [pnpm-workspace.yaml](pnpm-workspace.yaml) for shared external dependencies.
- Package TypeScript configurations must extend [tsconfig.base.json](tsconfig.base.json) without loosening strictness.
- New packages use `packages/<name>` and `@rsvp-engine/<name>`, follow an existing package's layout, and provide their own `typecheck` script. Do not introduce TypeScript project references without a solution configuration.

## Authorization

- Commit, PR creation, and merge each require separate explicit user authorization.
- Versioning and publishing require an explicit release request.
