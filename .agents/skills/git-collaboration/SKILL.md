---
name: git-collaboration
description: Prepare and manage collaborative Git and GitHub changes involving branches, commits, forks, pull requests, CI follow-up, conflicts, synchronization, or cleanup. Use for delivery workflows, not Git tutoring or releases.
---

# Git Collaboration

## Respect Scope

- Commit, push, fork creation, PR creation, approval, merge, settings changes, release, and branch deletion are separate effects. Do not perform an unrequested effect.
- A request to submit a PR includes preparing coherent commits, pushing a topic branch, opening the PR, and observing its initial required checks. It does not include approval, merge, settings changes, or release unless an explicit standing instruction makes auto-merge part of submission.
- Preserve unrelated changes and existing history. Confirm exact targets before destructive or history-rewriting operations.
- Treat Git and GitHub metadata as public. Do not expose secrets or private operational data.

## Discover Policy Efficiently

Use applicable `AGENTS.md` instructions already in context. Search contribution guidance for relevant branch, commit, PR, test, and release-impact rules. Prefer targeted searches and bounded reads. Read package-specific guidance only for affected paths.

Read an applicable PR template in full. Repository and user rules override generic branch prefixes, commit formats, merge strategies, and checklists.

## Protect the Working State

Before changing Git state, inspect the branch, status, staged and unstaged diffs, remotes, base branch, and relevant commit range. Stage deliberately. Group commits by responsibility; do not absorb unrelated files.

Run relevant repository checks and report only checks actually run. If the project tracks release impact, decide whether the PR needs an entry. Do not version or publish packages.

## Select One Collaboration Mode

For remote, PR, or post-merge work, identify the canonical repository and effective permission. Do not infer ownership from remote names. Use GitHub metadata when available.

- With `ADMIN`, `MAINTAIN`, or `WRITE` permission on the canonical repository, read [references/maintainer.md](references/maintainer.md).
- Without direct write permission, read [references/external-contributor.md](references/external-contributor.md).
- If permission is unknown and the next external mutation depends on it, ask first.

Read exactly one role reference. Local-only work may not need either. Switch only when new facts invalidate the classification.

## Write Reviewable Pull Requests

Use the repository PR template when present. Otherwise state the reason, outcome, and actual validation. Add release impact, risk, migration, security, screenshots, or issues only when relevant. Headings are optional; omit empty sections. Use the repository's language, or English when none is established.

When PR submission is in scope, follow required checks. Diagnose failures before retrying. Keep fixes within scope. Do not approve, bypass requirements, or merge unless separately requested or a standing instruction authorizes auto-merge.
