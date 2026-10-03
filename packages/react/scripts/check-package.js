import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const esm = await import("@rsvp-engine/react");
const require = createRequire(import.meta.url);
const cjs = require("@rsvp-engine/react");

for (const exportedFunction of ["createRsvpController", "createRsvpContext"]) {
  if (typeof esm[exportedFunction] !== "function" || typeof cjs[exportedFunction] !== "function") {
    throw new Error(`ESM/CJS entry points do not expose ${exportedFunction}.`);
  }
}

const context = esm.createRsvpContext();
for (const entry of [esm, cjs]) {
  const controller = entry.createRsvpController();
  controller.setWpm(225);
  if (controller.getSnapshot().snapshot.wpm !== 225 || "setSpeed" in controller) {
    throw new Error("Published controller must preserve WPM through setWpm only.");
  }
  controller.destroy();
}

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

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const temporaryDirectory = mkdtempSync(join(tmpdir(), "rsvp-react-package-"));

try {
  const archive = join(temporaryDirectory, "react.tgz");
  execFileSync("pnpm", ["--filter", "@rsvp-engine/react", "pack", "--out", archive], {
    cwd: workspaceRoot,
    stdio: "pipe",
  });
  const files = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }),
  );
  assert.notEqual(manifest.private, true, "The tarball must be publishable.");
  assert.equal(manifest.publishConfig?.access, "public");
  assert.equal(manifest.publishConfig?.provenance, true);
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.repository?.directory, "packages/react");
  const coreManifest = JSON.parse(
    readFileSync(new URL("../../core/package.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.dependencies["@rsvp-engine/core"], coreManifest.version);
  for (const version of Object.values(manifest.dependencies)) {
    assert(
      !/^(workspace|catalog):/.test(version),
      "Packed dependencies must resolve outside the workspace.",
    );
  }
  for (const file of [
    "README.md",
    "LICENSE",
    manifest.main,
    manifest.module,
    manifest.types,
    manifest.exports["."].import.default,
    manifest.exports["."].require.default,
    manifest.exports["."].import.types,
    manifest.exports["."].require.types,
  ]) {
    assert(files.includes(`package/${file.replace(/^\.\//, "")}`), `Missing packed file: ${file}`);
  }
  // Changesets creates the changelog during the first versioning step.
  if (existsSync(join(packageRoot, "CHANGELOG.md"))) {
    assert(files.includes("package/CHANGELOG.md"), "The generated changelog must be packed.");
  } else {
    assert.equal(manifest.version, "0.0.0", "Versioned releases require a generated changelog.");
  }
  assert(!files.some((file) => /^package\/(docs|src|type-tests|node_modules)\//.test(file)));
  console.log(
    "Tarball includes public entries, types, license, and README with resolved dependencies.",
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
