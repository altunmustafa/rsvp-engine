import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const esm = await import("@rsvp-engine/core");
const require = createRequire(import.meta.url);
const cjs = require("@rsvp-engine/core");

if (typeof esm.RSVPEngine !== "function" || typeof cjs.RSVPEngine !== "function") {
  throw new Error("Published ESM/CJS entry points do not expose RSVPEngine.");
}

for (const file of [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "dist/index.d.ts",
  "dist/index.d.cts",
]) {
  if (!existsSync(new URL(`../${file}`, import.meta.url))) {
    throw new Error(`Required package file is missing: ${file}.`);
  }
}

console.log("ESM, CJS, declarations, README, license, and changelog are present.");
