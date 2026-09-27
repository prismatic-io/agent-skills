import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { findCniProjects, verifyCni } from "./scripts/verify-generated-cni.mjs";

const fixture = async (fn: (root: string) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), "cni-check-test-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};
const project = async (
  root: string,
  scripts: Record<string, string> = { build: 'node -e "process.exit(0)"' },
  main?: string,
) => {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      dependencies: { "@prismatic-io/spectral": "10.30.3" },
      scripts,
      ...(main ? { main } : {}),
    }),
  );
  await mkdir(join(root, "dist"), { recursive: true });
  await writeFile(
    join(root, "dist", "index.js"),
    'module.exports = { default: { codeNativeIntegrationYAML: "flows: []" } };\n',
  );
};
test("discovers root and deeply nested Spectral projects", async () =>
  fixture(async (root) => {
    await project(root);
    assert.equal((await findCniProjects(root))[0].directory, root);
    assert.equal((await verifyCni(root)).ok, true);
    await rm(join(root, "package.json"));
    await project(join(root, "output", "integration"));
    assert.equal(
      (await findCniProjects(root))[0].directory,
      join(root, "output", "integration"),
    );
  }));
test("ignores dependency/build trees and rejects ambiguous sibling projects", async () =>
  fixture(async (root) => {
    await project(join(root, "node_modules", "dependency"));
    await project(join(root, "dist", "output"));
    assert.equal((await findCniProjects(root)).length, 0);
    await project(join(root, "one"));
    await project(join(root, "two"));
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /found 2/);
  }));
test("runs later checks after a real failing script, with no install", async () =>
  fixture(async (root) => {
    await project(root, {
      typecheck: 'node -e "process.exit(3)"',
      test: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(0)"',
    });
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.checks.map((x) => [x.script, x.status]),
      [
        ["typecheck", "failed"],
        ["test", "passed"],
        ["build", "passed"],
        ["entry-load", "passed"],
      ],
    );
  }));
test("missing build is explicit and available tests still run", async () =>
  fixture(async (root) => {
    await project(root, { test: 'node -e "process.exit(0)"' });
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.equal(result.checks[0].status, "missing");
    assert.equal(result.checks[1].status, "passed");
  }));
test("bounded timeout records failure and continues", async () =>
  fixture(async (root) => {
    await project(root, {
      test: 'node -e "setInterval(()=>{},1000)"',
      build: 'node -e "process.exit(0)"',
    });
    const result = await verifyCni(root, { timeoutMs: 500 });
    assert.equal(result.ok, false);
    assert.match(result.checks[0].error ?? "", /ETIMEDOUT/);
    assert.equal(result.checks[1].status, "passed");
  }));

// Script success is diagnostic, not proof that a registered integration exists.
test("a no-op build without the Prism entry fails the local entry diagnostic", async () =>
  fixture(async (root) => {
    await project(root);
    await rm(join(root, "dist", "index.js"));
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.equal(result.entryLoad, "checked");
    assert.deepEqual(
      result.checks.map((check) => [check.script, check.status]),
      [
        ["build", "passed"],
        ["entry-load", "failed"],
      ],
    );
  }));

test("Prism prefers root index.js over dist and stale package main", async () =>
  fixture(async (root) => {
    const directory = join(root, "project");
    await project(directory, undefined, "output/integration.mjs");
    await writeFile(join(root, "project.json"), "{}");
    await writeFile(
      join(directory, "dist", "index.js"),
      'throw new Error("wrong entry");\n',
    );
    const entry = join(directory, "index.js");
    await writeFile(
      entry,
      'module.exports = { default: { codeNativeIntegrationYAML: "flows: []" } };\n',
    );
    const valid = await verifyCni(root);
    assert.equal(valid.ok, true);
    assert.equal(valid.entryLoad, "checked");
    await writeFile(
      entry,
      'throw new Error("Invalid trigger configuration");\n',
    );
    const invalid = await verifyCni(root);
    assert.equal(invalid.ok, false);
    assert.deepEqual(
      invalid.checks.map(({ script, status }) => [script, status]),
      [
        ["build", "passed"],
        ["entry-load", "failed"],
      ],
    );
  }));

test("Prism uses dist/index.js when root index.js is absent and validates the CNI definition", async () =>
  fixture(async (root) => {
    await project(root, undefined, "stale/missing.js");
    assert.equal((await verifyCni(root)).ok, true);
    await writeFile(
      join(root, "dist", "index.js"),
      "module.exports = { default: {} };\n",
    );
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.equal(result.checks.at(-1)?.script, "entry-load");
    assert.equal(result.checks.at(-1)?.status, "failed");
  }));

test("entry loading does not invoke fetch against a service", async () =>
  fixture(async (root) => {
    await project(root);
    await writeFile(
      join(root, "index.js"),
      'fetch("https://example.invalid/service");\n',
    );
    const result = spawnSync(
      process.execPath,
      [join(import.meta.dirname, "scripts/load-cni-entry.mjs"), root],
      { encoding: "utf8", timeout: 2_000 },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Network connections are disabled/);
  }));

test("an arbitrary package main is not treated as a supported Prism entry", async () =>
  fixture(async (root) => {
    await project(root, undefined, "output/integration.js");
    await rm(join(root, "dist", "index.js"));
    await mkdir(join(root, "output"));
    await writeFile(
      join(root, "output", "integration.js"),
      'module.exports = { default: { codeNativeIntegrationYAML: "flows: []" } };\n',
    );
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.equal(result.checks.at(-1)?.script, "entry-load");
    assert.equal(result.checks.at(-1)?.status, "failed");
  }));
