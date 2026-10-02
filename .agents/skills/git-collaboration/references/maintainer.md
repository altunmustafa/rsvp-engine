# Maintainer Flow

Use this mode only with confirmed write permission to the canonical repository.

- Respect protected branches, required checks, and unresolved reviews when delivering or merging.
- Rewrite or force-push a shared branch only when necessary and authorized.

## Merge Gates

- Use the merge method required by the target repository or explicitly selected by the user, within repository protections. Check any resulting commit-title requirements against the actual PR metadata. Stop if the available tool cannot satisfy a required merge method or title convention.
- Before merging a breaking public API, major release impact, production dependency/toolchain upgrade, workflow/release/permission change, cross-component architecture change, or security-sensitive code, explain the risk and ensure the owner's merge authorization covers it. Ask only if that risk was not covered by an earlier confirmation.

## Auto-Merge

Enable auto-merge only after a separate, explicit user instruction, when the change is inside any stated risk boundary and non-gating review work is complete. PR creation never supplies this authorization.

- Never use `--admin`.
- If the PR is immediately mergeable and the authorized auto-merge command performs the merge, verify the reported result before continuing.
- If auto-merge is unavailable or rejected, leave the PR open and diagnose the cause. Do not weaken requirements.

After auto-merge is enabled:

- Check required checks, review threads, and PR state within the requested follow-up scope. Use a supported automation only when ongoing monitoring is requested.
- Stop on an actionable failure or persistent blocked state.
- Do not claim a merge until GitHub reports the PR as merged.

## Post-Merge

Record the PR base, head branch, head commit, merge method, and merged state before cleanup.

- For a Codex-managed worktree, leave Git state in place for possible follow-up. When worktree archival is authorized, use the app's worktree archival tool. Archiving the chat is a separate action and is not implied by worktree cleanup.
- For a local checkout or manual worktree, require a clean tree and confirm the local topic tip matches the recorded PR head. Switch to the verified base only if that branch is not owned by another worktree, update it with fast-forward only, prune stale tracking refs, and delete only the verified local topic branch when authorized.
- Forced local deletion is acceptable only after the commit comparison succeeds and GitHub confirms a squash or rebase merge that Git cannot represent as ancestry.
- If repository settings already delete merged head branches, do not issue a redundant remote deletion. Otherwise remote deletion requires authorization.
- Repository settings changes and releases are never implicit post-merge work.
