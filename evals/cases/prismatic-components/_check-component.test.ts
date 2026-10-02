import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
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

test("component discovery stops at each source package and still finds sibling projects", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-packaging-"));
  try {
    for (const directory of ["first", "first/review-copy", "second"]) {
      await mkdir(join(root, directory), { recursive: true });
      await writeFile(
        join(root, directory, "package.json"),
        JSON.stringify({
          dependencies: { "@prismatic-io/spectral": "10.30.3" },
        }),
      );
    }
    assert.deepEqual(
      (await findComponents(root)).map(({ directory }) => directory).sort(),
      [join(root, "first"), join(root, "second")],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local checks allow a separately packaged review copy without querying the original identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-review-copy-"));
  try {
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "prism"),
      "#!/usr/bin/env node\nthrow new Error('Local checks must not query publication');\n",
      { mode: 0o755 },
    );
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: { "@prismatic-io/spectral": "10.30.3" },
        scripts: Object.fromEntries(
          ["typecheck", "build", "test"].map((name) => [
            name,
            'node -e "process.exit(0)"',
          ]),
        ),
      }),
    );
    await mkdir(join(root, "dist"));
    await writeFile(
      join(root, "dist/index.js"),
      'module.exports.default = {key: "maintained-original"};\n',
    );
    await mkdir(join(root, "review-copy/dist"), { recursive: true });
    await writeFile(
      join(root, "review-copy/package.json"),
      JSON.stringify({
        main: "dist/index.js",
        dependencies: { "@prismatic-io/spectral": "10.30.3" },
      }),
    );
    await writeFile(
      join(root, "review-copy/dist/index.js"),
      'module.exports.default = {key: "separate-review-copy"};\n',
    );
    const result = spawnSync(
      process.execPath,
      [resolve(import.meta.dirname, "_check-component.ts")],
      {
        cwd: root,
        env: {
          ...process.env,
          CI: "true",
          PATH: `${bin}${delimiter}${process.env.PATH}`,
        },
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
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
