# TypeScript consumer fixture

A private workspace consumer of the public Core and React package exports. It checks ESM and CommonJS declarations under NodeNext and ESM declarations under bundler resolution, with strict mode and library checking enabled.

The source files are compiled for type checking only; they are not executed. Expected-error assertions verify that item and selector types remain precise. Workspace dependencies are injected, and their build outputs are synchronized before consumer checks.

The uncached `sync:injected` task runs after each dependency's build, including cache restores, and triggers pnpm's `syncInjectedDepsAfterScripts` hook. Its empty Node command exists to trigger that hook; the build remains cacheable. Fixture lint, type, and compatibility checks wait for synchronization because cached builds do not run pnpm's build lifecycle hook.

From the repository root:

```sh
pnpm verify --filter=@rsvp-engine/typescript-consumer-fixture
```

This fixture validates built workspace packages. It does not replace installation checks against packed npm tarballs.
