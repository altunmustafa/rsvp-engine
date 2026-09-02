// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginImportX from "eslint-plugin-import-x";
import pluginTsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    name: "global-ignores",
    ignores: ["**/dist/**", "**/node_modules/**", "**/temp/**"],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,

  {
    name: "register-all-plugins",
    plugins: {
      "import-x": pluginImportX,
      tsdoc: pluginTsdoc,
    },
  },

  {
    name: "base",
    languageOptions: {
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022,
        projectService: true,
        // @ts-expect-error - import.meta.dirname is supported in Node 20.11+/21.2+, but standard ImportMeta types don't include it yet.
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],

      // Safety
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // General
      "no-console": "warn",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],

      // Import ordering
      "import-x/no-cycle": "error",
      "import-x/no-duplicates": "error",
      "import-x/order": [
        "error",
        {
          groups: ["type", "builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      "sort-imports": [
        "error",
        {
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
        },
      ],

      // TSDoc
      "tsdoc/syntax": "warn",
    },
  },

  {
    name: "disables/typechecking",
    files: ["**/*.js", "**/*.test.ts", "**/*.config.ts", "**/docs/**"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    name: "browser-example-globals",
    files: ["examples/core-browser-reader/**/*.ts", "examples/core-readability-reader/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
]);
