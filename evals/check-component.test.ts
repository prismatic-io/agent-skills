import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "vitest";
import {
  checkBaseline,
  dependencyInstall,
  findComponents,
  withComponentWorkspace,
} from "./check-component.ts";

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

test("disposable checks preserve source, build output and dependency caches", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-workspace-source-"));
  let workspace = "";
  try {
    for (const dir of [
      "src",
      "dist",
      "node_modules/example",
      "node_modules/.vite",
    ])
      await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, "src/index.ts"), "original source");
    await writeFile(join(root, "dist/index.js"), "original build");
    await writeFile(join(root, "node_modules/example/index.js"), "dependency");
    await writeFile(join(root, "node_modules/.vite/cache"), "original cache");
    await withComponentWorkspace(root, async (directory) => {
      workspace = directory;
      assert.equal(
        await readFile(join(directory, "src/index.ts"), "utf8"),
        "original source",
      );
      await assert.rejects(access(join(directory, "dist")));
      assert.equal(
        await readFile(
          join(directory, "node_modules/example/index.js"),
          "utf8",
        ),
        "dependency",
      );
      await writeFile(join(directory, "src/index.ts"), "mutated copy");
      await writeFile(
        join(directory, "node_modules/example/index.js"),
        "changed dependency copy",
      );
      await mkdir(join(directory, "dist"));
      await writeFile(join(directory, "dist/index.js"), "rebuilt copy");
      await mkdir(join(directory, "node_modules/.vite"));
      await writeFile(join(directory, "node_modules/.vite/cache"), "new cache");
    });
    await assert.rejects(access(workspace));
    assert.equal(
      await readFile(join(root, "src/index.ts"), "utf8"),
      "original source",
    );
    assert.equal(
      await readFile(join(root, "dist/index.js"), "utf8"),
      "original build",
    );
    assert.equal(
      await readFile(join(root, "node_modules/example/index.js"), "utf8"),
      "dependency",
    );
    assert.equal(
      await readFile(join(root, "node_modules/.vite/cache"), "utf8"),
      "original cache",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("disposable check cleanup also runs after a failed assertion", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-workspace-failure-"));
  let workspace = "";
  try {
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "package.json"), "{}");
    await assert.rejects(
      withComponentWorkspace(root, async (directory) => {
        workspace = directory;
        throw new Error("behavior regressed");
      }),
      /behavior regressed/,
    );
    await assert.rejects(access(workspace));
    assert.equal(await readFile(join(root, "package.json"), "utf8"), "{}");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dependency restoration respects the supplied lockfile", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-lock-choice-"));
  try {
    assert.equal((await dependencyInstall(root)).args[0], "install");
    await writeFile(join(root, "package-lock.json"), "{}");
    assert.equal((await dependencyInstall(root)).args[0], "ci");
    await writeFile(join(root, "bun.lock"), "{}");
    assert.deepEqual(await dependencyInstall(root), {
      command: "bun",
      args: ["install", "--frozen-lockfile"],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dependency-free frozen evidence is restored without modifying the snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-frozen-source-"));
  try {
    const pkg = JSON.stringify({ name: "frozen-evidence", version: "1.0.0" });
    const lock = JSON.stringify({
      name: "frozen-evidence",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: { "": { name: "frozen-evidence", version: "1.0.0" } },
    });
    await writeFile(join(root, "package.json"), pkg);
    await writeFile(join(root, "package-lock.json"), lock);
    await writeFile(join(root, ".npmrc"), "cache=./.npm-cache\n");
    await withComponentWorkspace(root, async (directory) => {
      assert.notEqual(directory, root);
      assert.equal(
        await readFile(join(directory, "package-lock.json"), "utf8"),
        lock,
      );
    });
    await assert.rejects(access(join(root, "node_modules")));
    await assert.rejects(access(join(root, ".npm-cache")));
    assert.equal(await readFile(join(root, "package-lock.json"), "utf8"), lock);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
