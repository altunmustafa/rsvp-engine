import { readFileSync, readdirSync } from "node:fs";

const packageRoot = new URL("../", import.meta.url);
const sourceRoot = new URL("../src/", import.meta.url);
const forbiddenSource = /\b(?:window|document|HTMLElement)\b|["']react-dom(?:\/[^"']*)?["']/;
const typescriptFile = /\.tsx?$/;
const testFile = /\.(?:test|spec)\.tsx?$/;

function isProductionSource(entry) {
  return entry.isFile() && typescriptFile.test(entry.name) && !testFile.test(entry.name);
}

function productionSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) {
      return productionSourceFiles(url);
    }

    return isProductionSource(entry) ? [url] : [];
  });
}

for (const file of productionSourceFiles(sourceRoot)) {
  if (forbiddenSource.test(readFileSync(file, "utf8"))) {
    throw new Error(`Forbidden DOM dependency in ${file.pathname}.`);
  }
}

const manifest = JSON.parse(readFileSync(new URL("package.json", packageRoot), "utf8"));
const runtimeDependencies = Object.keys(manifest.dependencies ?? {}).sort();
const allowedRuntimeDependencies = ["@rsvp-engine/core", "use-sync-external-store"];
if (manifest.private !== true) {
  throw new Error("The React package must remain private until release preparation.");
}
if (JSON.stringify(runtimeDependencies) !== JSON.stringify(allowedRuntimeDependencies)) {
  throw new Error(
    `Runtime dependencies must remain limited to: ${allowedRuntimeDependencies.join(", ")}.`,
  );
}
if (manifest.dependencies?.["@rsvp-engine/core"] !== "workspace:*") {
  throw new Error("The React package must depend on Core through workspace:*.");
}
if (manifest.dependencies?.["use-sync-external-store"] !== "catalog:") {
  throw new Error("The React package must use React's official external-store selector package.");
}
if (typeof manifest.peerDependencies?.react !== "string") {
  throw new Error("React must be declared as a peer dependency.");
}
if (
  manifest.dependencies?.react ||
  manifest.dependencies?.["react-dom"] ||
  manifest.peerDependencies?.["react-dom"]
) {
  throw new Error("React must not be a runtime dependency and React DOM must not be required.");
}

console.log(
  "Architecture constraints passed: private, Core-backed, official-selector, React-peer, and DOM-free.",
);
