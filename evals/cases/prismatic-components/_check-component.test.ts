import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "vitest";
import { checkBaseline, findComponents } from "./_check-component.ts";

test("component discovery excludes dependencies and generated build folders", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-discovery-"));
  try {
    for (const dir of ["component", "node_modules/example", "dist", ".cache"]) {
      await mkdir(join(root, dir), { recursive: true });
      await writeFile(
        join(root, dir, "package.json"),
        JSON.stringify({
          dependencies: { "@prismatic-io/spectral": "10.30.3" },
        }),
      );
    }
    assert.deepEqual(
      (await findComponents(root)).map(({ directory }) => directory),
      [join(root, "component")],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("baseline verification runs the original even when subject tests change", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-baseline-"));
  try {
    const fixture = join(root, "fixture"),
      subject = join(root, "subject");
    await mkdir(fixture);
    await mkdir(subject);
    await symlink(
      resolve(import.meta.dirname, "node_modules"),
      join(subject, "node_modules"),
      "dir",
    );
    await writeFile(
      join(fixture, "baseline.test.ts"),
      "throw new Error('regression');\n",
    );
    await writeFile(
      join(subject, "baseline.test.ts"),
      "// deleted assertions\n",
    );
    await assert.rejects(checkBaseline(subject, fixture), /failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("a successful package test script cannot hide a failing baseline", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-baseline-run-"));
  try {
    const fixture = join(root, "fixture"),
      subject = join(root, "subject");
    await mkdir(fixture);
    await mkdir(subject);
    await symlink(
      resolve(import.meta.dirname, "node_modules"),
      join(subject, "node_modules"),
      "dir",
    );
    await writeFile(
      join(subject, "package.json"),
      JSON.stringify({ scripts: { test: "echo success" }, type: "module" }),
    );
    const source =
      "import {test, expect} from 'vitest'; test('behavior', () => expect(1).toBe(2));\n";
    await writeFile(join(fixture, "baseline.test.ts"), source);
    await writeFile(join(subject, "baseline.test.ts"), source);
    await assert.rejects(checkBaseline(subject, fixture), /failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("baseline verification allows added tests in the existing file", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-baseline-added-"));
  try {
    const fixture = join(root, "fixture"),
      subject = join(root, "subject");
    await mkdir(fixture);
    await mkdir(subject);
    await symlink(
      resolve(import.meta.dirname, "node_modules"),
      join(subject, "node_modules"),
      "dir",
    );
    const source =
      "import {test, expect} from 'vitest'; test('original', () => expect(1).toBe(1));\n";
    await writeFile(join(fixture, "baseline.test.ts"), source);
    await writeFile(
      join(subject, "baseline.test.ts"),
      `${source}test('added', () => expect(2).toBe(2));\n`,
    );
    await checkBaseline(subject, fixture);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
