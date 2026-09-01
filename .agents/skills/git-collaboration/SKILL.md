---
name: git-collaboration
description: "Use when changing Git state or performing GitHub delivery: branches, worktrees, commits, pushes, pull requests, review follow-up, merge, synchronization, or cleanup. Do not use for ordinary file edits, read-only work, Git tutoring, or releases."
---

# Git Collaboration

## Authorization Boundaries

Implementation, commit, push/PR, merge, settings, release, and cleanup are separate effects. Perform only effects the user explicitly requested or a repository rule explicitly authorizes.

- An implementation request authorizes edits and proportionate validation, not commit, push, PR, auto-merge, or merge.
- A PR request may authorize its necessary push and PR creation, but never auto-merge or manual merge.
- Merge or auto-merge always requires a distinct explicit instruction. Never bypass checks or unresolved reviews.
- Preserve unrelated work and history. Confirm destructive, history-rewriting, or deletion targets.

## Read Only What Is Needed

Use applicable `AGENTS.md` instructions already in context. Search contribution docs for relevant branch, commit, test, PR, merge, and release rules; read only affected package guidance. Read a PR template in full only when preparing a PR.

For remote/PR work, identify the canonical repository and permission from GitHub metadata, not remote names. Read exactly one role guide: [maintainer](references/maintainer.md) for `ADMIN`, `MAINTAIN`, or `WRITE`; otherwise [external contributor](references/external-contributor.md). Ask when permission is unknown and required for the next external mutation. Local-only work needs neither guide.

Keep context lean: prefer targeted searches, bounded diffs, and compact status; do not repeat unchanged policy or output. Report only commands actually run, and include raw output only when it supports a decision or failure diagnosis.

## Inspect and Isolate

Before changing Git state or performing GitHub delivery, inspect branch/HEAD, status, staged and unstaged diffs, worktrees, remotes, base, upstream, and relevant commits.

- Continue a suitable topic branch/worktree. For new work, never edit tracked files on local `main`: fetch the canonical remote and create `<type>/<short-kebab-description>` from its latest default branch. If the remote is unavailable, stop and present options instead of choosing a fallback.
- Use the current checkout for sequential work. Use a separate worktree for concurrent writes, unrelated dirty work, an in-use checkout, or an explicit request; place manual worktrees at `<repository-parent>/.worktrees/<repository-name>/<task-slug>`. One writer owns Git state per worktree.
- Keep one coherent goal per branch and PR. Never discard or absorb unrelated work.

## Prepare and Request Commit Approval

Follow the repository's implementation, test, and release-impact rules. Run proportionate checks and the canonical verification command when required. Review the complete diff against its base; use an independent reviewer when available. Address evidence-based findings and rerun affected checks.

Do not commit automatically. When ready, present a compact change summary, checks, release-impact decision, risks, and exact repository-compliant commit message; ask for approval. If denied, keep the work uncommitted and wait. Never hard-wrap commit-body prose. After review begins, prefer additive correction commits over rewriting shared history.

## Create a PR Only on Request

When PR creation is requested, run `pnpm verify`, then complete the repository template from the final diff and actual checks. Validate the exact title with the repository validator. Create the PR once with its final title/body; omit placeholders and empty sections, and never hard-wrap PR-body prose. Update it only when scope, validation, release impact, or risk materially changes.

Follow required checks and review threads within scope. Diagnose before retrying. Do not approve your own work.

## Merge and Finish Only on Request

For an authorized merge, use the required method and verify GitHub's result; never infer a merge from local history. Release work remains separate.

- Keep in-scope follow-ups on the same branch/PR before merge; start post-merge tracked changes on a fresh branch.
- Preserve Codex-managed worktrees for follow-up; archive only when authorized.
- Clean local/manual worktrees only after a clean-tree check and exact merged-head verification.
- Branch deletion is separate unless repository automation performs it.
