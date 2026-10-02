---
name: git-collaboration
description: "Handles Git state changes and GitHub delivery: branches, commits, PRs, merge, and cleanup. Use for these operations or PR review follow-up, not ordinary edits, read-only inspection, or releases."
---

# Git Collaboration

## Authorization Boundaries

Implementation, commit, push/PR, merge, settings, release, and cleanup are separate effects. Perform only effects the user explicitly requested or a repository rule explicitly authorizes.

Use authorization already given in the conversation for the relevant effect; ask only for a missing authorization or a material change of scope. Follow the target repository's applicable authorization rules; authorization for one effect does not automatically authorize another.

- An implementation request authorizes edits and proportionate validation, not commit, push, PR, auto-merge, or merge.
- A PR request may authorize its necessary push and PR creation, but never auto-merge or manual merge.
- Merge or auto-merge always requires a distinct explicit instruction. Never bypass checks or unresolved reviews.
- Preserve unrelated work and history; do not stage unrelated changes with the requested commit. Confirm destructive, history-rewriting, or deletion targets.

## Read Only What Is Needed

Use applicable `AGENTS.md` instructions already in context. Search contribution docs for relevant branch, commit, test, PR, merge, and release rules; read only affected package guidance. Read a PR template in full only when preparing a PR.

For remote/PR work, identify the canonical repository and relevant permissions from GitHub metadata, not remote names. Read only the applicable role guide: [maintainer](references/maintainer.md) for confirmed write access; [external contributor](references/external-contributor.md) for confirmed lack of direct write access. Unknown permission is not evidence of either role: resolve it before a mutation that requires it, while continuing independent local preparation. Local-only work needs neither guide.

Keep context lean: prefer targeted searches, bounded diffs, and compact status; do not repeat unchanged policy or output. Report only commands actually run, and include raw output only when it supports a decision or failure diagnosis.

## Inspect and Isolate

Check worktree ownership before switching or removing a checkout so another task's working directory is not disrupted.

- Continue a suitable topic branch/worktree. For new work, follow the repository's naming and base conventions and use a topic branch when required. Fetch when a current remote base is required; an explicitly selected local base needs no remote access. If a required base cannot be obtained, report the blocker and continue work that does not depend on it; do not silently substitute a different base.
- Use the current checkout for sequential work. Use a separate worktree for concurrent writes, unrelated dirty work, an in-use checkout, or an explicit request. Use the environment's managed worktree tool when available; otherwise follow the repository's location convention or choose an isolated location outside the checkout. One writer owns Git state per worktree.

## Prepare an Authorized Commit

Follow the target repository's commit, verification, and release-impact requirements.

If commit authorization is missing, make the proposed commit reviewable before asking; scale the explanation to the change. If already authorized, proceed. If approval is denied without an explanation, ask why and wait without retrying. Never hard-wrap commit-body prose. After review begins, prefer additive correction commits over rewriting shared history.

## Create a PR Only on Request

Follow the target repository's PR template, title conventions, and required verification. Never hard-wrap PR-body prose.

If a PR creation response is ambiguous, check whether it succeeded before creating another. Do not approve your own work.

## Merge and Finish Only on Request

For an authorized merge, use the required method and verify GitHub's result; never infer a merge from local history. Release work remains separate.

- Keep in-scope follow-ups on the same branch/PR before merge; start post-merge tracked changes on a fresh branch.
- Preserve Codex-managed worktrees for follow-up; archive only when authorized.
- Clean local/manual worktrees only after a clean-tree check and exact merged-head verification.
- Branch deletion is separate unless repository automation performs it.
