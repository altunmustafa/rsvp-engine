# Contributing to RSVP Engine

Thanks for contributing. This guide takes a change from local setup through review. Keep each contribution focused and ask in the issue or pull request when a project rule is unclear.

## Set Up the Workspace

You need Git and the Node.js/pnpm versions declared by the root [`package.json`](package.json). That file is the source of truth for supported and preferred tooling versions.

From the repository root, run:

```bash
pnpm install
```

This installs the workspace and configures the Git hooks. Run all workspace commands from the repository root; do not use plain `npm` or `yarn` commands inside packages because they bypass workspace resolution and Turborepo orchestration.

Before changing a package, read its contributor guide and linked design documentation when available. For Core, start with [`packages/core/CONTRIBUTING.md`](packages/core/CONTRIBUTING.md).

## Create a Focused Branch

Start from the canonical repository's current default branch and create a short-lived branch:

```text
<type>/<short-kebab-description>
```

Use one of the [commit types](#commit-messages) for `<type>`. Keep the description lowercase and omit contributor names; an issue number may lead the description when useful.

```text
feat/configurable-tokenizer
fix/123-pause-delay
docs/core-api-examples
```

Keep one coherent outcome per branch and pull request. When working on multiple branches at once, use separate worktrees and never check out one branch in two worktrees.

## Develop Test-First

1. Add or update a failing test that describes the intended behavior.
2. Implement the smallest change that makes it pass.
3. Refactor without weakening the test or package constraints.
4. Update documentation when public behavior or contracts change.
5. Add a Changeset when the change affects package consumers.
6. Run focused checks while iterating and the full verification before opening a pull request.

Use filters for faster package-level feedback, for example:

```bash
pnpm --filter @rsvp-engine/core test
pnpm --filter @rsvp-engine/core build
```

Core API changes require workspace-wide verification because other packages may depend on them.

## Record Release Impact

[Changesets](https://github.com/changesets/changesets) determine package versions and changelog entries. Add one for a consumer-visible change to a published package:

```bash
pnpm changeset
```

Choose the release level from the public contract:

| Level   | Use when                                              |
| ------- | ----------------------------------------------------- |
| `patch` | Correcting behavior without breaking compatibility    |
| `minor` | Adding backward-compatible public behavior            |
| `major` | Making a backward-incompatible API or behavior change |

Write the summary for package consumers and include migration guidance for breaking changes. Commit the generated `.changeset/*.md` file with its change.

A Changeset is normally unnecessary for tests, formatting, CI, repository-only documentation, or internal refactors. A corrected file shipped in an npm package needs a Changeset when consumers need a new release to receive it.

Never hand-edit package versions or generated changelog sections, and do not delete pending Changesets to clean the working tree.

## Verify the Change

Before opening a pull request, run the canonical workspace check:

```bash
pnpm verify
```

Report only checks you actually ran. If verification fails, fix the cause or clearly document the unresolved failure before requesting review.

## Commit Messages

Use Conventional Commits:

```text
<type>[optional scope]: <description>
```

Choose the type that best describes the commit:

- `feat`, `fix`, or `perf` for consumer-visible behavior;
- `refactor` for restructuring without a behavior change;
- `test`, `docs`, or `style` for their named concerns;
- `build`, `ci`, or `chore` for repository and tooling maintenance;
- `revert` for reverting an earlier change.

The Git hook validates messages with Commitlint. Keep headers, body entries, and footers naturally concise enough to satisfy [`commitlint.config.js`](commitlint.config.js); never hard-wrap prose. A commit type does not determine the package release level—the Changeset does.

## Open a Pull Request

Before submission:

1. Review the complete branch diff against the current default branch.
2. Confirm tests, documentation, and Changesets match the final scope.
3. Complete [the pull request template](.github/PULL_REQUEST_TEMPLATE.md) with the outcome, checks actually run, release impact, and known risks.
4. Validate the exact Conventional Commit title:

```bash
printf '%s\n' "$PR_TITLE" | pnpm exec commitlint
```

Create the pull request with its final title and body. Do not use placeholders or hard-wrap prose. Update the body only when scope, validation, release impact, or risk materially changes.

After review begins, add correction commits instead of rewriting shared history. Pull requests are squash-merged so each reviewed change becomes one commit on the default branch.

## Releases

Contributors include required Changesets; maintainers handle versioning and publishing after merge. Do not run `pnpm changeset version` or `pnpm changeset publish`, or edit generated release files, unless a maintainer explicitly asks you to participate in a release.
