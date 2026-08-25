# Contributing to RSVP Engine

Thank you for contributing to RSVP Engine. This guide explains how to prepare the workspace, develop a change, document its release impact, and submit it for review.

## Prerequisites

- A Node.js version supported by the root `package.json` (`^22.11`, `^24`, or `>=26`).
- pnpm 10 or newer. The exact pnpm release used by the project is declared in the root `package.json`.
- Git.

The published Core package supports older Node.js runtimes independently of this development-tooling requirement.

## Prepare the Workspace

Clone your fork, install dependencies from the repository root, and create a short-lived branch:

```bash
pnpm install
git switch -c feat/short-description
```

### Branch Naming

Use short-lived branches named with the following pattern:

```text
<type>/<short-kebab-description>
```

Choose a type that describes the branch's primary purpose: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, or `release`. Write the description in lowercase kebab-case, without a contributor name. An issue number may appear at the start of the description when useful.

```text
feat/configurable-tokenizer
fix/123-pause-remaining-delay
docs/core-api-examples
refactor/event-dispatch
chore/update-typescript
```

Keep one coherent change on each branch. The branch type improves navigation but does not determine the commit type or Changesets release level; choose those independently from the actual change.

Read the package-specific contributor guide before changing a package. For Core, see [`packages/core/CONTRIBUTING.md`](packages/core/CONTRIBUTING.md).

Run workspace commands from the repository root. Do not invoke plain `npm` or `yarn` build and test commands inside an individual package because that bypasses workspace dependency resolution and Turborepo orchestration.

## Development Workflow

1. Write or update a failing test that describes the intended behavior.
2. Implement the smallest change that makes the test pass.
3. Refactor without weakening the test or package constraints.
4. Update public documentation when the contract or behavior changes.
5. Add a changeset when a published package's public behavior changes.
6. Run the relevant verification commands before opening a pull request.

For the entire workspace:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

For one package, prefer a filtered command while iterating:

```bash
pnpm --filter @rsvp-engine/core test
pnpm --filter @rsvp-engine/core build
```

Run broader workspace checks before merging a Core public API change because downstream packages may depend on it.

## Changesets

Changesets, not commit-message parsing, determine package versions and generated changelog entries.

Add a changeset for a consumer-visible change to a published package:

```bash
pnpm changeset
```

Choose the release type from the public contract:

| Type    | Use when                                                      |
| ------- | ------------------------------------------------------------- |
| `patch` | Fixing incorrect behavior without breaking compatibility.     |
| `minor` | Adding backward-compatible public functionality.              |
| `major` | Making a backward-incompatible public API or behavior change. |

Write the summary for package consumers. Describe the observable outcome and include migration guidance for a breaking change. Commit the generated `.changeset/*.md` file with the code that it describes.

A changeset is normally unnecessary for tests, formatting, CI, repository-only documentation, or an internal refactor that cannot affect consumers. A correction to a file shipped in the npm package, such as its README, needs a `patch` changeset if the corrected file must reach npm consumers.

Do not edit package versions or generated changelog release sections by hand. Do not delete pending changesets merely to make the directory clean; they are release inputs.

## Commit and Pull Request Conventions

Use Conventional Commits for readable Git history:

```text
<type>(<scope>): <subject>
```

Common types are `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, and `chore`. A commit type does not automatically select a package version; the accompanying changeset is authoritative.

A pull request should:

- explain the consumer-visible outcome;
- include tests for behavior changes;
- include a changeset when required;
- update affected documentation;
- pass build, test, lint, typecheck, and package-specific quality gates.

## Release Workflow

Release maintainers accumulate changesets on `main`, then perform versioning and publishing as separate reviewable operations.

Inspect the pending plan:

```bash
pnpm changeset status
```

Apply pending changesets:

```bash
pnpm changeset version
```

Review the resulting package versions, changelogs, internal dependency updates, lockfile changes, and consumed changeset files. Run the full verification suite and commit these generated release changes.

Only after the version commit is reviewed and npm authentication and package metadata are ready, publish and push the generated tags:

```bash
pnpm changeset publish
git push --follow-tags
```
