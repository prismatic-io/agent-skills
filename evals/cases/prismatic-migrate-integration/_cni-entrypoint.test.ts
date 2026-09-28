import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { resolveCniEntrypoint } from "./_cni-entrypoint.mjs";

const workspace = async (
  check: (root: string, outside: string) => Promise<void>,
) => {
  const parent = await realpath(
    await mkdtemp(join(tmpdir(), "cni-entrypoint-")),
  );
  const root = join(parent, "project");
  const outside = join(parent, "outside");
  await Promise.all([mkdir(root), mkdir(outside)]);
  try {
    await check(root, outside);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
};
const put = async (
  root: string,
  path: string,
  contents = "module.exports = { default: {} };\n",
) => {
  const full = join(root, path);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, contents);
  return full;
};
test("standard Prism scaffold resolves dist/index.js despite source package.main", async () => {
  await workspace(async (root) => {
    await put(root, "package.json", JSON.stringify({ main: "src/index.ts" }));
    await put(root, "src/index.ts", "const x: number = 1;");
    const expected = await put(root, "dist/index.js");
    assert.equal(await resolveCniEntrypoint(root), expected);
  });
});
test("cwd index.js takes precedence and requires no package manifest", async () => {
  await workspace(async (root) => {
    const expected = await put(root, "index.js");
    await put(root, "dist/index.js", "const bad: number = 1;");
    assert.equal(await resolveCniEntrypoint(root), expected);
  });
});
test("nested cwd finds nearest package rather than outer project package", async () => {
  await workspace(async (root) => {
    await put(root, "package.json", "{}");
    await put(root, "dist/index.js");
    await put(root, "packages/inner/package.json", "{}");
    const expected = await put(root, "packages/inner/dist/index.js");
    const cwd = join(root, "packages/inner/src");
    await mkdir(cwd);
    assert.equal(await resolveCniEntrypoint(root, cwd), expected);
  });
});
test("missing compiled file never follows package.main or falls through an inner package", async () => {
  await workspace(async (root) => {
    await put(root, "package.json", '{"main":"custom.js"}');
    await put(root, "custom.js");
    await put(root, "src/index.ts", "export default {};");
    await assert.rejects(resolveCniEntrypoint(root), /Missing compiled/);
    await put(root, "dist/index.js");
    await put(root, "inner/package.json", "{}");
    await assert.rejects(
      resolveCniEntrypoint(root, join(root, "inner")),
      /Missing compiled/,
    );
  });
});
test("raw TypeScript under index.js is rejected without executing it", async () => {
  await workspace(async (root) => {
    await put(
      root,
      "index.js",
      "const typed: number = 1;\nthrow new Error('must not execute');",
    );
    await assert.rejects(resolveCniEntrypoint(root), /not valid JavaScript/);
  });
});
test("entrypoint file and directory symlinks cannot escape project", async () => {
  await workspace(async (root, outside) => {
    const external = await put(outside, "index.js");
    await symlink(external, join(root, "index.js"));
    await assert.rejects(resolveCniEntrypoint(root), /remain inside/);
    await rm(join(root, "index.js"));
    await put(root, "package.json", "{}");
    await symlink(outside, join(root, "dist"));
    await assert.rejects(resolveCniEntrypoint(root), /remain inside/);
  });
});
test("in-project JavaScript symlink is supported but TypeScript target is rejected", async () => {
  await workspace(async (root) => {
    const compiled = await put(root, "built/compiled.js");
    await symlink(compiled, join(root, "index.js"));
    assert.equal(await resolveCniEntrypoint(root), compiled);
    await rm(join(root, "index.js"));
    const source = await put(root, "src/index.ts", "export default {};");
    await symlink(source, join(root, "index.js"));
    await assert.rejects(resolveCniEntrypoint(root), /not TypeScript/);
  });
});
test("search does not consume package metadata above the project or outside cwd", async () => {
  await workspace(async (root, outside) => {
    await put(join(root, ".."), "package.json", "{}");
    await assert.rejects(resolveCniEntrypoint(root), /No package.json/);
    await symlink(outside, join(root, "external"));
    await assert.rejects(
      resolveCniEntrypoint(root, join(root, "external")),
      /working directory must remain/,
    );
  });
});
