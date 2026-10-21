import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const esmBundle = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
const cjsBundle = readFileSync(new URL("../dist/index.cjs", import.meta.url), "utf8");
for (const external of ["@rsvp-engine/core", "react", "use-sync-external-store"]) {
  if (!esmBundle.includes(external) || !cjsBundle.includes(external)) {
    throw new Error(`${external} must remain external in both package bundles.`);
  }
}

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
    ...Object.values(manifest.exports).flatMap((entry) => [
      entry.import.default,
      entry.require.default,
      entry.import.types,
      entry.require.types,
    ]),
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

  const consumerRoot = join(temporaryDirectory, "consumer");
  const consumerModules = join(consumerRoot, "node_modules");
  const installedReact = join(consumerModules, "@rsvp-engine", "react");
  const installedCore = join(installedReact, "node_modules", "@rsvp-engine", "core");
  const coreArchive = join(temporaryDirectory, "core.tgz");
  execFileSync("pnpm", ["--filter", "@rsvp-engine/core", "pack", "--out", coreArchive], {
    cwd: workspaceRoot,
    stdio: "pipe",
  });
  for (const [tarball, destination] of [
    [archive, installedReact],
    [coreArchive, installedCore],
  ]) {
    mkdirSync(destination, { recursive: true });
    execFileSync("tar", ["-xzf", tarball, "--strip-components=1", "-C", destination]);
  }

  // Core is installed only beneath React; this consumer cannot import Core directly.
  // Exercise the subpath before installing React to verify its independent runtime boundary.
  for (const [format, imports] of [
    [
      "module",
      `import assert from "node:assert/strict";
       import * as subpath from "@rsvp-engine/react/core";
       import * as core from ${JSON.stringify(pathToFileURL(join(installedCore, coreManifest.exports["."].import.default)).href)};`,
    ],
    [
      "commonjs",
      `const assert = require("node:assert/strict");
       const subpath = require("@rsvp-engine/react/core");
       const core = require(${JSON.stringify(installedCore)});`,
    ],
  ]) {
    execFileSync(
      process.execPath,
      [
        `--input-type=${format}`,
        "--eval",
        `
      ${imports}
      for (const name of Object.keys(core).filter(
        (name) => name !== "default" && name !== "module.exports",
      )) {
        assert.equal(subpath[name], core[name], "Core subpath must preserve the identity of " + name);
      }
    `,
      ],
      { cwd: consumerRoot, stdio: "pipe" },
    );
  }

  for (const dependency of ["react", "use-sync-external-store"]) {
    symlinkSync(
      dirname(require.resolve(`${dependency}/package.json`)),
      join(consumerModules, dependency),
      "dir",
    );
  }
  for (const [format, imports] of [
    [
      "module",
      'import assert from "node:assert/strict"; import { createRsvpContext, createRsvpController } from "@rsvp-engine/react"; import { TextTokenizer, MissingTokenizerError } from "@rsvp-engine/react/core";',
    ],
    [
      "commonjs",
      'const assert = require("node:assert/strict"); const { createRsvpContext, createRsvpController } = require("@rsvp-engine/react"); const { TextTokenizer, MissingTokenizerError } = require("@rsvp-engine/react/core");',
    ],
  ]) {
    execFileSync(
      process.execPath,
      [
        `--input-type=${format}`,
        "--eval",
        `
      ${imports}
      const controller = createRsvpController({ tokenizer: new TextTokenizer() });
      controller.load("word");
      assert.equal(controller.getSnapshot().currentItem.value, "word");
      controller.destroy();
      const { RsvpProvider } = createRsvpContext();
      assert.equal(typeof RsvpProvider, "function");
      const empty = createRsvpController();
      assert.throws(() => empty.load("text"), MissingTokenizerError);
      empty.destroy();
    `,
      ],
      { cwd: consumerRoot, stdio: "pipe" },
    );
  }
  console.log(
    "Packed ESM/CJS consumers use Core through React alone; its subpath preserves Core identities without React.",
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
