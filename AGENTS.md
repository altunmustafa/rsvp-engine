# RSVP Engine

Read the applicable package's `AGENTS.md` when working there; its more specific instructions take precedence over this file.

## Development and Verification

- Use pnpm from the repository root so workspace resolution and task orchestration apply.
- For code changes, follow the mandatory TDD workflow in [CONTRIBUTING.md](CONTRIBUTING.md#develop-test-first) and the affected package's contributor guide. Load design references when the change touches their subject.
- Use `pnpm verify --filter=<pkg>` for package verification. Core API or behavior changes require checking downstream packages, examples, and compatibility fixtures and running workspace-wide `pnpm verify`.
- For documentation-only changes, check affected links and formatting. Before opening a PR, follow the full verification requirements in [CONTRIBUTING.md](CONTRIBUTING.md#verify-the-change).
- Fix failures caused by the requested change and rerun affected checks; report unrelated failures. Treat configuration and validation scripts as the source of truth for quality thresholds; do not weaken them to make checks pass.

## Dependency Boundaries

- Core must remain free of production dependencies, including other workspace packages. Adapters may depend on Core, but must not import from sibling adapters. Raise shared logic that needs a new package as an architecture decision.
- Use `workspace:*` for internal dependencies and the catalog in [pnpm-workspace.yaml](pnpm-workspace.yaml) for shared external dependencies.
- Package TypeScript configurations must extend [tsconfig.base.json](tsconfig.base.json) without loosening strictness.
- When adding a package, use `packages/<name>` and `@rsvp-engine/<name>`, follow an existing package's layout, and provide its own `typecheck` script. Keep package-specific constraints in its `AGENTS.md`. Add workspace globs only if needed; do not introduce TypeScript project references without a solution configuration.

## Decisions and Delivery

- Use the project-local `record-adrs` skill for durable architecture decisions affecting contracts, dependencies, runtime behavior, or portability.
- For consumer-visible changes, follow [Changeset guidance](CONTRIBUTING.md#record-release-impact). Do not delete pending Changesets or hand-edit package versions or generated changelog entries. Versioning and publishing require an explicit release request.
- Commit, PR creation, and merge each require separate explicit user authorization.
- Use `git-collaboration` when changing Git state or performing GitHub delivery, including branches, commits, remotes, pushes, PRs, conflicts, synchronization, and cleanup. Read-only work and ordinary file edits do not trigger it.
