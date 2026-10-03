import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  fixedExtension: false,
  target: "es2022",
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  treeshake: true,
  deps: {
    neverBundle: ["@rsvp-engine/core", "react", "use-sync-external-store"],
  },
});
