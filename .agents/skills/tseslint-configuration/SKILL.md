---
name: tseslint-configuration
description: Set up and maintain typescript-eslint flat config (eslint.config.js/mjs) for TypeScript projects. Use whenever creating or editing ESLint config for a TypeScript project, migrating from the deprecated tseslint.config() to ESLint's defineConfig(), enabling type-aware ("typed") linting, or troubleshooting typescript-eslint plugin/rule registration. Trigger on mentions of "eslint.config", "typescript-eslint", "tseslint", "flat config", or requests to set up/fix linting for a TS or mixed JS/TS project.
license: Apache-2.0
---

# typescript-eslint Flat Config

Source: https://typescript-eslint.io/getting-started/ (typescript-eslint v8.42+)

## Setup

1. Install:
   - npm: `npm install --save-dev eslint @eslint/js typescript typescript-eslint`
   - pnpm: `pnpm add -D eslint @eslint/js typescript typescript-eslint`
   - yarn: `yarn add -D eslint @eslint/js typescript typescript-eslint`
2. Create `eslint.config.mjs` (or `eslint.config.js` if `package.json` has `"type": "module"`):

```js
// @ts-check
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({
  files: ["**/*.{js,ts}"],
  extends: [js.configs.recommended, tseslint.configs.recommended],
});
```

3. Run: `npx eslint .`

Layer `tseslint.configs.strict` / `tseslint.configs.stylistic` on top of `recommended` in `extends` for stricter/opinionated rules.

## Critical: use `defineConfig`, not `tseslint.config`

`tseslint.config()` is **deprecated** (typescript-eslint v8.42.0+) in favor of ESLint core's `defineConfig()`, imported from `"eslint/config"` (available since ESLint v9.22.0). Always scaffold new configs with `defineConfig`.

```js
// deprecated
export default tseslint.config({ /* ... */ });

// current
import { defineConfig } from 'eslint/config';
export default defineConfig({ /* ... */ });
```

`defineConfig` flattens either form identically:

```js
defineConfig({/* a */}, {/* b */}); // variadic — fixed, short lists
defineConfig([{/* a */}, {/* b */}]); // array — composing/spreading configs programmatically
```

## Type-aware ("typed") linting

Add the `TypeChecked` config variant and `projectService`:

```js
export default defineConfig({
  files: ["**/*.{js,ts}"],
  extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
  languageOptions: {
    parserOptions: { projectService: true },
  },
});
```

Variant mapping: `recommended`→`recommendedTypeChecked`, `strict`→`strictTypeChecked`, `stylistic`→`stylisticTypeChecked`.

## Pitfalls to Avoid

### Pitfall: Unscoped Type-Aware Linting on Non-Source Files

**Symptom:** Enabling `projectService: true` globally without excluding test files, config scripts, or files outside `tsconfig.json`'s coverage. **Consequence:** Drastically degrades ESLint performance and causes parser errors on files not tracked by `tsconfig.json`. **Fix:** Add a scoped override block for non-source/config files using `tseslint.configs.disableTypeChecked` with `parserOptions: { projectService: false }`:

```js
export default defineConfig(
  {/* typed config from above */},
  {
    files: ["**/*.config.{js,mjs}", "**/*.test.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
```

### Pitfall: Redundant Plugin Declarations Across Rule Blocks

**Symptom:** Declaring `plugins: { "import-x": importPlugin }` redundantly inside every individual rule block. **Consequence:** Clutters configuration files and introduces potential namespace mismatch risks. **Fix:** Register plugins once in a dedicated base block so downstream rule blocks can reference namespaced rules cleanly:

```js
{ name: 'register-all-plugins', plugins: { 'import-x': importPlugin } }
```

## Gotchas

- In `eslint.config.js` files using `// @ts-check`, `import.meta.dirname` (Node 20.11+) can raise a type error depending on the installed `@types/node` version — suppress with `// @ts-expect-error` on that line rather than removing `@ts-check` entirely.
- `// @ts-check` is optional; drop it if it fights your project's TS setup rather than fighting the checker.
