import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const spectral = require.resolve("@prismatic-io/spectral");
const verifier = fileURLToPath(
  new URL("./_verify-generated-cni.mjs", import.meta.url),
);
const checkProject = async (
  source?: string,
  main = "index.js",
  output = "dist/index.js",
  escapeKind?: "absolute" | "symlink",
  installedDependencies = false,
  mode = "all",
  extraScripts: Record<string, string> = {},
) => {
  const directory = await mkdtemp(join(tmpdir(), "cni-verifier-"));
  try {
    const project = join(directory, "port");
    const outputPath = escapeKind ? join(directory, "outside.cjs") : output;
    const entryMain = escapeKind === "absolute" ? outputPath : main;
    await mkdir(project);
    await mkdir(join(directory, "legacy"));
    await writeFile(join(directory, "legacy/example.eml"), "source message");
    await mkdir(join(directory, "legacy/build"));
    await writeFile(
      join(directory, "legacy/build/source.txt"),
      "exported source",
    );
    await mkdir(join(project, "node_modules"));
    if (installedDependencies) {
      const dependency = join(project, "node_modules/@prismatic-io/spectral");
      await mkdir(dependency, { recursive: true });
      await writeFile(
        join(dependency, "package.json"),
        JSON.stringify({ name: "@prismatic-io/spectral", main: "index.cjs" }),
      );
      await writeFile(
        join(dependency, "index.cjs"),
        `module.exports = require(${JSON.stringify(spectral)});`,
      );
    }
    if (escapeKind === "symlink")
      await symlink(outputPath, join(project, main));
    await writeFile(
      join(project, "package.json"),
      JSON.stringify({
        main: entryMain,
        dependencies: {
          "@prismatic-io/spectral": "10.30.3",
        },
        scripts: { build: "node build.cjs", ...extraScripts },
      }),
    );
    await writeFile(
      join(project, "build.cjs"),
      source === undefined
        ? "// successful no-op build"
        : `const fs = require('node:fs/promises'); const path = require('node:path'); fs.mkdir(path.dirname(${JSON.stringify(outputPath)}), {recursive:true}).then(() => fs.copyFile('source.cjs', ${JSON.stringify(outputPath)}));`,
    );
    if (source !== undefined)
      await writeFile(join(project, "source.cjs"), source);
    const manifestBefore = await readFile(
      join(project, "package.json"),
      "utf8",
    );
    const result = spawnSync(process.execPath, [verifier, directory, mode], {
      encoding: "utf8",
      timeout: 15000,
    });
    assert.ifError(result.error);
    assert.equal(
      await readFile(join(project, "package.json"), "utf8"),
      manifestBefore,
      "verification must preserve the source manifest",
    );
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const integrationSource = `const { integration, flow } = require(${JSON.stringify(spectral)}); module.exports = integration({name:'Order transfer',description:'Verifier fixture',flows:[flow({name:'Transfer orders',stableKey:'orders',onExecution:async()=>({data:null})})]});`;

test("declared tests can read sibling legacy inputs in the native verification workspace", async () => {
  const result = await checkProject(
    integrationSource,
    "index.js",
    "dist/index.js",
    undefined,
    true,
    "checks",
    {
      test: `node -e "(async () => { const fs=require('node:fs/promises'); const assert=require('node:assert/strict'); assert.equal(await fs.readFile('../legacy/example.eml','utf8'),'source message'); assert.equal(await fs.readFile('../legacy/build/source.txt','utf8'),'exported source'); await fs.writeFile('../legacy/example.eml','mutated copy'); })()"`,
    },
  );
  assert.equal(result.status, 0, result.output);
});

test("a lint failure is reported as project checks, not an unbuildable CNI", async () => {
  const lintFailure = { lint: "node -e 'process.exit(1)'" };
  const build = await checkProject(
    integrationSource,
    "index.js",
    "dist/index.js",
    undefined,
    false,
    "build",
    lintFailure,
  );
  assert.equal(build.status, 0, build.output);
  const checks = await checkProject(
    integrationSource,
    "index.js",
    "dist/index.js",
    undefined,
    false,
    "checks",
    lintFailure,
  );
  assert.notEqual(checks.status, 0);
  assert.match(checks.output, /npm run lint failed/);
}, 30_000);

test("successful package scripts without a compiled artifact cannot pass", async () => {
  const result = await checkProject();
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Missing compiled CNI entrypoint/);
});

test("compiled detached helper cannot substitute for registered CNI", async () => {
  const result = await checkProject(
    "module.exports = { transform: input => input };",
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /not detached helpers/);
});

test("registered YAML without executable flow action cannot pass", async () => {
  const result = await checkProject(
    `${integrationSource}\nmodule.exports.actions = {};`,
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /no executable registered action/);
});

test("actual Spectral output at the Prism entrypoint passes without optional scripts", async () => {
  const result = await checkProject(integrationSource);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Validated 1 registered CNI flow/);
});

test("Prism scaffold main relative to dist is supported", async () => {
  const result = await checkProject(
    integrationSource,
    "index.js",
    "dist/index.js",
  );
  assert.equal(result.status, 0, result.output);
});

test("registered loading uses live dependencies without an extra installation", async () => {
  const source = integrationSource.replace(
    JSON.stringify(spectral),
    JSON.stringify("@prismatic-io/spectral"),
  );
  const result = await checkProject(
    source,
    "index.js",
    "dist/index.js",
    undefined,
    true,
  );
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /restoring|npm install|npm ci/);
  assert.match(result.output, /Validated 1 registered CNI flow/);
});

test("a missing runtime dependency fails without a support-code installation", async () => {
  const source = integrationSource.replace(
    JSON.stringify(spectral),
    JSON.stringify("@prismatic-io/spectral"),
  );
  const result = await checkProject(source);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Cannot find module/);
  assert.doesNotMatch(result.output, /restoring|npm install|npm ci/);
});

test("package.main cannot substitute a non-Prism output for the importable CNI", async () => {
  const result = await checkProject(
    integrationSource,
    "dist/custom.cjs",
    "dist/custom.cjs",
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Missing compiled CNI entrypoint/);
});

test("package.main is ignored when the real Prism output exists", async () => {
  const result = await checkProject(
    integrationSource,
    "../outside.cjs",
    "dist/index.js",
  );
  assert.equal(result.status, 0, result.output);
});

test("Prism root index.js output is supported", async () => {
  const result = await checkProject(
    integrationSource,
    "unrelated.cjs",
    "index.js",
  );
  assert.equal(result.status, 0, result.output);
});

test("an absolute package.main cannot load an outside artifact", async () => {
  const result = await checkProject(
    integrationSource,
    "index.js",
    "index.js",
    "absolute",
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Missing compiled CNI entrypoint/);
});

test("a Prism entrypoint symlink cannot load an outside artifact", async () => {
  const result = await checkProject(
    integrationSource,
    "index.js",
    "index.js",
    "symlink",
  );
  assert.notEqual(result.status, 0);
  assert.match(result.output, /must remain inside the project/);
});
