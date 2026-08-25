import { readFileSync, readdirSync } from "node:fs";

const sourceRoot = new URL("../src/", import.meta.url);
const forbidden = /\b(?:window|document|HTMLElement)\b/;

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory() ? sourceFiles(url) : entry.name.endsWith(".ts") ? [url] : [];
  });
}

for (const file of sourceFiles(sourceRoot)) {
  if (forbidden.test(readFileSync(file, "utf8"))) {
    throw new Error(`Forbidden DOM API reference in ${file.pathname}.`);
  }
}

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (Object.keys(manifest.dependencies ?? {}).length > 0) {
  throw new Error("Core must have zero production dependencies.");
}

console.log("Architecture constraints passed: zero DOM references and zero runtime dependencies.");
