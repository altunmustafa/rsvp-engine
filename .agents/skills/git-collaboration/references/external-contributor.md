# External Contributor Flow

Use this mode without direct write permission to the canonical repository.

- Identify the canonical repository from GitHub metadata or the PR target. Remote names are hints, not proof. Commonly, `origin` is the fork and `upstream` is canonical.
- Reuse a suitable fork and remotes. Creating a fork is an external change; obtain authorization first. Do not rename or replace remotes merely to fit a convention.
- Base the topic branch on the canonical base. Push only to a writable fork, then target the canonical repository in the PR.
- Do not assume access to canonical settings, rulesets, secrets, environments, or protected workflows.
- Do not enable auto-merge or merge the canonical PR; those are maintainer actions.
- Respect fork PR token and approval limits. Do not weaken Actions permissions or run untrusted fork code with privileged events.
- Track visible checks and feedback. Separate code failures from checks awaiting maintainer action.

For cleanup, verify the canonical PR was merged and follow the surface-aware cleanup rules in `SKILL.md`. In a clean local checkout or manual worktree, delete only the confirmed local topic branch when authorized. Force local deletion only after a verified squash or rebase merge that Git cannot detect by ancestry.

Delete the fork branch only when explicitly requested. Never delete or rewrite canonical branches.
