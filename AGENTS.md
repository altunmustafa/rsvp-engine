# RSVP Engine (Monorepo)

A pnpm-workspace monorepo for RSVP (Rapid Serial Visual Presentation) tooling. `@rsvp-engine/core` is the headless, zero-dependency engine; the other packages wrap it for specific environments and frameworks.

## Packages

| Package | Path | Depends on | Purpose |
| --- | --- | --- | --- |
| `@rsvp-engine/core` | `packages/core` | — | Headless, zero-dependency state machine, scheduler, OVP calculation |
| `@rsvp-engine/dom` | `packages/dom` | `core` | HTML/DOM parsing and extraction for browser input |
| `@rsvp-engine/react` | `packages/react` | `core` | React hooks / headless components |
| `@rsvp-engine/vue` | `packages/vue` | `core` | Vue composables / headless components |

> Package-specific constraints live in each package's `AGENTS.md`. Always check the nearest `AGENTS.md` to the file you are editing; it takes precedence over this file.

## Workspace Commands

Run from the repo root unless a package path is given.

- **Install:** `pnpm install`
- **Build all:** `pnpm build` (Turborepo builds dependencies first)
- **Build one package:** `pnpm --filter @rsvp-engine/core build`
- **Test all:** `pnpm test`
- **Test one package:** `pnpm --filter @rsvp-engine/core test`
- **Coverage:** `pnpm test:coverage`
- **Lint:** `pnpm lint`
- **Format:** `pnpm format`
- **Typecheck all:** `pnpm typecheck`
- **Create a changeset:** `pnpm changeset`

Run workspace commands from the repository root, using `pnpm --filter <pkg>` when needed. Plain `npm` or `yarn` commands inside packages bypass workspace resolution and Turborepo orchestration.

## Repo Structure

```
rsvp-engine/
├── packages/
│   ├── core/       → @rsvp-engine/core   (AGENTS.md: strict, zero-dep, <5KB, ≥95% coverage)
│   ├── dom/        → @rsvp-engine/dom
│   ├── react/      → @rsvp-engine/react
│   └── vue/        → @rsvp-engine/vue
├── examples/        # demo apps, private, not published
├── .changeset/
├── pnpm-workspace.yaml # workspace packages and dependency catalog
├── turbo.json
└── tsconfig.base.json

```

## Cross-Package Architectural Rules

- **Dependency direction is one-way:** `dom`, `react`, and `vue` may depend on `core`; `core` must not depend on another workspace package and must remain dependency-free in production.
- **Internal dependencies use `workspace:*`:** For example, `"@rsvp-engine/core": "workspace:*"`.
- **Shared external dependencies use the catalog:** Declare common versions under `catalog:` in `pnpm-workspace.yaml` and reference them as `"dependency": "catalog:"`.
- **No cross-imports between sibling packages:** `react` must not import from `dom` or `vue`. If two framework packages need to share non-`core` logic, that logic belongs in `core` or a new shared package — raise this rather than adding a sibling dependency.
- **Check downstream compatibility for Core API changes:** Review `react`, `vue`, and `dom` whenever Core's exported types or behavior change.
- **Strict TypeScript applies everywhere:** Package configurations extend `tsconfig.base.json` and must not loosen strictness.

## Versioning & Releases

- Changesets control independent package versions. Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) to decide when one is required and commit it with the change it describes.
- Do not delete pending changesets or hand-edit package versions and generated changelog entries.
- Do not run `changeset version` or `changeset publish` unless the user explicitly requests a release.

## Adding a New Package

1. Scaffold under `packages/<name>/` following an existing package's layout (`package.json`, `tsconfig.json`, `src/`, `AGENTS.md`).

2. Name it `@rsvp-engine/<name>` to match the folder name.

3. Reference shared dependencies using `catalog:` instead of explicit versions.
4. Add a package-level `AGENTS.md` for package-specific constraints.
5. Add a root TypeScript project reference; update `pnpm-workspace.yaml` only if its globs do not already include the package.

## Contribution & TDD Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions, PR expectations, Changesets usage, release steps, and the mandatory TDD workflow that applies across all packages.
