import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  minify: true,
  treeshake: true,
  external: ["@rsvp-engine/core", "react", "use-sync-external-store"],
});
