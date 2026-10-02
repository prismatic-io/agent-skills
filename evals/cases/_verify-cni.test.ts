import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { findCniProjects, verifyCni } from "./_verify-cni.mjs";

const require = createRequire(import.meta.url);
const spectralPath = require.resolve("@prismatic-io/spectral");
// Positive controls come from the installed SDK's compiler, independently of
// the verifier's understanding of its generated registration structure.
const validEntry = `
const { integration, flow } = require(${JSON.stringify(spectralPath)});
module.exports.default = integration({
  name: "Checker control",
  flows: [flow({
    name: "Receive", stableKey: "receive",
    onExecution: async () => ({ data: { received: true } }),
  })],
});
`;

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
  await writeFile(join(root, "dist", "index.js"), validEntry);
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
        ["registration", "passed"],
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
test("native Prism validation rejects a successful build with no integration", async () =>
  fixture(async (root) => {
    await project(root);
    await writeFile(
      join(root, "dist", "index.js"),
      "module.exports.default = {};\n",
    );
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.equal(result.checks.at(-1)?.script, "registration");
    assert.equal(result.checks.at(-1)?.status, "failed");
  }));

test("a failed build cannot validate a stale compiled integration", async () =>
  fixture(async (root) => {
    await project(root, { build: 'node -e "process.exit(1)"' });
    const result = await verifyCni(root);
    assert.equal(result.ok, false);
    assert.equal(result.checks.length, 1);
  }));

test("migration tests retain access to sibling source files", async () =>
  fixture(async (root) => {
    await mkdir(join(root, "legacy"));
    await writeFile(join(root, "legacy", "source.txt"), "source contract");
    await project(join(root, "replacement"), {
      build: 'node -e "process.exit(0)"',
      test: `node -e "require('node:assert/strict').equal(require('node:fs').readFileSync('../legacy/source.txt','utf8'),'source contract')"`,
    });
    assert.equal((await verifyCni(root)).ok, true);
  }));

test("published import convention prefers root index.js and ignores package main", async () =>
  fixture(async (root) => {
    await project(root, undefined, "missing-custom-entry.js");
    assert.equal((await verifyCni(root)).ok, true);
    await writeFile(
      join(root, "index.js"),
      "throw new Error('root entry failed');",
    );
    assert.equal((await verifyCni(root)).ok, false);
  }));
