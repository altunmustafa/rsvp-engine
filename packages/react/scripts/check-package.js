import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const esm = await import("@rsvp-engine/react");
const require = createRequire(import.meta.url);
const cjs = require("@rsvp-engine/react");

for (const exportedFunction of ["createRsvpController", "createRsvpContext"]) {
  if (typeof esm[exportedFunction] !== "function" || typeof cjs[exportedFunction] !== "function") {
    throw new Error(`ESM/CJS entry points do not expose ${exportedFunction}.`);
  }
}

const context = esm.createRsvpContext();
for (const contextFunction of [
  "RsvpProvider",
  "useRsvpSelector",
  "useRsvpActions",
  "useRsvpController",
]) {
  if (typeof context[contextFunction] !== "function") {
    throw new Error(`Context factory does not expose ${contextFunction}.`);
  }
}

if ("useRsvp" in esm || "useRsvpSnapshot" in esm) {
  throw new Error("Legacy controller-bound hooks must not remain public exports.");
}

for (const file of ["dist/index.js", "dist/index.cjs", "dist/index.d.ts", "dist/index.d.cts"]) {
  if (!existsSync(new URL(`../${file}`, import.meta.url))) {
    throw new Error(`Required package file is missing: ${file}.`);
  }
}

const esmBundle = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
const cjsBundle = readFileSync(new URL("../dist/index.cjs", import.meta.url), "utf8");
for (const external of ["@rsvp-engine/core", "react", "use-sync-external-store"]) {
  if (!esmBundle.includes(external) || !cjsBundle.includes(external)) {
    throw new Error(`${external} must remain external in both package bundles.`);
  }
}

console.log("ESM, CJS, declarations, public React API, and external peers are present.");
