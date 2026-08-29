---
name: git-collaboration
description: Deliver collaborative Git and GitHub changes through isolated branches or worktrees, coherent commits, pull requests, review, merge follow-up, synchronization, and cleanup. Use for delivery workflows, not Git tutoring or releases.
---

# Git Collaboration

## Preserve Authorization Boundaries

- Commit, push, fork creation, PR creation, approval, merge, settings changes, release, and branch deletion are separate effects. Perform only effects authorized by the user or an applicable standing repository instruction.
- A request to submit a PR includes preparing coherent commits, pushing the topic branch, opening the PR, and observing its initial required checks. It does not imply approval, merge, settings changes, or release.
- Preserve unrelated changes and existing history. Confirm exact targets before destructive or history-rewriting operations.
- Treat Git and GitHub metadata as public. Do not expose secrets or private operational data.

## Discover the Effective Policy

Use applicable `AGENTS.md` instructions already in context. Search contribution guidance for relevant branch, commit, PR, test, and release-impact rules. Prefer targeted searches and bounded reads. Read package-specific guidance only for affected paths.

Read an applicable PR template in full. Repository and user rules override generic branch prefixes, commit formats, merge strategies, and checklists.

For remote, PR, or post-merge work, identify the canonical repository and effective permission from GitHub metadata rather than remote names:

- With `ADMIN`, `MAINTAIN`, or `WRITE` permission, read [references/maintainer.md](references/maintainer.md).
- Without direct write permission, read [references/external-contributor.md](references/external-contributor.md).
- If permission is unknown and the next external mutation depends on it, ask first.

Read exactly one role reference. Local-only work may not need either.

## Inspect and Isolate

Before changing Git state, inspect the current branch or detached HEAD, status, staged and unstaged diffs, worktree list, remotes, base branch, upstream tracking, and relevant commit range.

- Continue an existing coherent task in its current branch or worktree. Do not relocate it merely to fit a preferred layout.
- For new parallel implementation work, use one writable worktree, one topic branch, and one PR per coherent outcome. Base it on the repository-designated base branch unless a stacked change is intentional and documented.
- Keep a branch checked out in only one worktree. Use the product's handoff flow when available instead of checking the same branch out elsewhere.
- Give one primary agent ownership of writes and Git state in a worktree. Use subagents primarily for read-heavy exploration, testing, triage, and review; independent write goals belong in separate worktrees.
- Never discard, absorb, or rewrite unrelated local work.

## Prepare a Reviewable Change

Follow the repository's implementation and test workflow. Stage deliberately and group commits by responsibility. Avoid placeholder commits when coherent commits are practical. After review begins, prefer additive correction commits over rewriting shared history.

Run the repository's canonical verification command when one exists; otherwise run checks proportionate to the change. Report only checks actually run. If the project tracks release impact, decide whether the PR needs an entry. Do not version or publish packages.

Before push or PR submission, review the complete branch diff against its base with an independent or dedicated reviewer when available. Address findings based on evidence and rerun affected checks after material fixes.

## Write Reviewable Pull Requests

Use the repository PR template when present. Otherwise state the reason, outcome, and actual validation. Add release impact, risk, migration, security, screenshots, or issues only when relevant. Headings are optional; omit empty sections. Use the repository's language, or English when none is established.

Before opening a PR, formulate its final title and validate that exact string with the repository's title or commit-message validator. When the repository uses commitlint, pipe the title to `pnpm exec commitlint` through standard input. Do not open the PR until the title passes.

Follow required checks and review threads. Diagnose failures before retrying and keep fixes within scope. Do not approve your own work, bypass requirements, or merge without authorization. A standing auto-merge instruction applies only within its stated risk boundary and required merge method.

## Finish Deliberately

Verify the remote PR state instead of inferring it from local history. Do not claim a merge until GitHub reports it. Treat release work as a separate workflow.

Cleanup must match the active surface:

- In a Codex-managed worktree, do not switch that worktree to the base branch or delete its checked-out branch. Preserve it for follow-up; archive the associated task only when task archival is authorized.
- In a local checkout or manually managed worktree, require a clean tree, verify the exact merged head, update the base with fast-forward only, and remove only the confirmed topic branch when cleanup is authorized.
- Let repository settings delete remote head branches automatically. Otherwise, remote branch deletion remains a separate effect.
