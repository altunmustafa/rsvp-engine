# Maintainer Flow

Use this mode only with confirmed write permission to the canonical repository.

- Discover the default branch, repository merge settings, active rulesets or protections, remotes, and upstream tracking.
- Follow repository branch policy. Do not push directly to a protected base branch.
- Push the topic branch to a writable remote. Open the PR against the canonical base.
- Follow the repository's PR title and merge conventions. Track required CI.
- Rewrite or force-push a shared branch only when necessary and authorized.

## Auto-Merge

Enable auto-merge only when the user or a standing repository instruction authorizes it, the change is inside any stated risk boundary, and non-gating review work is complete.

- Use the repository-required merge method; do not choose from personal preference.
- Never use `--admin`.
- If the PR is immediately mergeable and the authorized auto-merge command performs the merge, verify the reported result before continuing.
- If auto-merge is unavailable or rejected, leave the PR open and diagnose the cause. Do not weaken requirements.

After auto-merge is enabled:

- Monitor required checks, review threads, and PR state.
- Stop on an actionable failure or persistent blocked state.
- Do not claim a merge until GitHub reports the PR as merged.

## Post-Merge

Record the PR base, head branch, head commit, merge method, and merged state before cleanup.

- For a Codex-managed worktree, leave Git state in place for possible follow-up. When archival is authorized, archive the task and let Codex manage the worktree lifecycle.
- For a local checkout or manual worktree, require a clean tree and confirm the local topic tip matches the recorded PR head. Switch to the verified base only if that branch is not owned by another worktree, update it with fast-forward only, prune stale tracking refs, and delete only the verified local topic branch when authorized.
- Forced local deletion is acceptable only after the commit comparison succeeds and GitHub confirms a squash or rebase merge that Git cannot represent as ancestry.
- If repository settings already delete merged head branches, do not issue a redundant remote deletion. Otherwise remote deletion requires authorization.
- Repository settings changes and releases are never implicit post-merge work.
