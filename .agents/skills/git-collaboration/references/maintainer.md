# Maintainer Flow

Use this mode only with confirmed write permission to the canonical repository.

- Discover the default branch, protections, remotes, and upstream tracking.
- Follow repository branch policy. Do not push directly to a protected base branch.
- Push the topic branch to a writable remote. Open the PR against the canonical base.
- Follow the repository's PR title and merge conventions. Track required CI.
- Rewrite or force-push a shared branch only when necessary and authorized.

If user or repository instructions make auto-merge the default, enable it after opening the PR with the required merge method. Do not bypass repository requirements. If auto-merge is unavailable or denied, leave the PR open and report it.

Cleanup requires a separate request. Verify the PR's merged state, base, and exact head branch on GitHub. With a clean tree, update the local default branch and prune stale remote-tracking refs. Delete only the verified topic branch.

Use forced local deletion only when GitHub confirms a squash or rebase merge that Git cannot detect by ancestry. Delete a remote topic branch only when explicitly requested. Never include repository settings, merge, or release in cleanup implicitly.
