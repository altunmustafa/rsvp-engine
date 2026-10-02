import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const esm = await import("@rsvp-engine/core");
const require = createRequire(import.meta.url);
const cjs = require("@rsvp-engine/core");

if (typeof esm.RsvpEngine !== "function" || typeof cjs.RsvpEngine !== "function") {
  throw new Error("Published ESM/CJS entry points do not expose RsvpEngine.");
}

for (const entry of [esm, cjs]) {
  if (typeof entry.DefaultOvpStrategy !== "function") {
    throw new Error("Published entry point does not expose DefaultOvpStrategy.");
  }
  if ("RSVPEngine" in entry || "DefaultOVPStrategy" in entry) {
    throw new Error("Legacy acronym-cased exports must not remain available.");
  }
  const engine = new entry.RsvpEngine();
  engine.setWpm(225);
  if (engine.wpm !== 225 || "setSpeed" in engine) {
    throw new Error("Published speed API must preserve WPM through setWpm only.");
  }
  engine.destroy();
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
