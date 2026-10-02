---
name: tseslint-configuration
description: Configures typescript-eslint flat config and diagnoses typed-linting or plugin-registration failures. Use for ESLint configuration changes, not ordinary source-code lint fixes.
license: Apache-2.0
---

# typescript-eslint Flat Config

## Configuration Changes

- Locate the ESLint configuration that applies to the affected files, their TypeScript configuration, and the target project's dependency manifests and package-manager settings. Use those files to establish tooling versions and commands. Preserve existing rule strength and file coverage unless the requested change calls for adjusting them.
- Use `defineConfig` from `eslint/config` for new configuration when supported by the installed tooling. If the requested approach needs a dependency upgrade, identify that requirement rather than expanding the task automatically. When migrating from `tseslint.config`, verify the effective configuration for affected file types rather than assuming identical `extends` scoping.
- For typed linting, use the appropriate `TypeChecked` presets and `parserOptions.projectService`. Before fixing a project-service error, check which TSConfig includes the failing file and which flat-config blocks match it.
- Use `tseslint.configs.disableTypeChecked` only for files intentionally excluded from typed linting. A test filename alone is not a reason to disable type-aware rules; preserve this repository's explicit exceptions unless changing them is in scope.
- Register a plugin namespace where all rules using it can see it. Avoid conflicting registrations in overlapping blocks.
- Diagnose config typing errors against the installed runtime and type definitions. Do not add a suppression or remove `// @ts-check` merely because an older setup needed that workaround.

## Verification and References

Use the target project's installed ESLint and package-manager or task-runner conventions. Inspect representative files with `eslint --print-config <file>` and lint affected files through the project's lint command or `eslint <files>`, run in the configuration's intended working directory. Include a file from any affected override or exclusion to check the configuration boundary. Follow the repository's verification requirements for delivery.

Consult the official [configuration API](https://typescript-eslint.io/packages/typescript-eslint/) for migrations, [typed-linting guide](https://typescript-eslint.io/getting-started/typed-linting/) for setup, and [troubleshooting guide](https://typescript-eslint.io/troubleshooting/typed-linting/) for project-service failures. Check version-sensitive behavior there when needed.
