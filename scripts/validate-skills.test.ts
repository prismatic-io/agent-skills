import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "vitest";
import { check, validateFrontmatter } from "./validate-skills.ts";

const valid = `---
name: prismatic-check
description: >
  Check integrations when asked to validate their configuration.
license: MIT
compatibility: Requires Prism authentication.
allowed-tools: Read
metadata:
  author: prismatic-io
  version: "1.0.0"
---
# Check integrations
Inspect the integration configuration.
`;

test("accepts portable optional fields and folded YAML descriptions", () => {
  assert.deepEqual(validateFrontmatter(valid, "prismatic-check"), []);
  assert.deepEqual(
    validateFrontmatter(valid.replaceAll("\n", "\r\n"), "prismatic-check"),
    [],
  );
});

const invalidCases = [
  valid.replace("name: prismatic-check", "name: wrong-name"),
  valid.replace("name: prismatic-check", "name: Prismatic--check"),
  valid.replace("description: >", "unexpected: >"),
  valid.replace(
    "description: >\n  Check integrations when asked to validate their configuration.",
    "description: 123",
  ),
  valid.replace('version: "1.0.0"', "version: 1.0"),
  valid.replace("license: MIT", "license: [MIT]"),
  valid.replace("Requires Prism authentication.", "x".repeat(501)),
  "---\nname: [unterminated\n---\n",
  "---\n- list\n---\n",
  "# No frontmatter",
];
for (const [index, content] of invalidCases.entries()) {
  test(`rejects invalid frontmatter ${index}`, () => {
    assert.ok(validateFrontmatter(content, "prismatic-check").length > 0);
  });
}

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

test("checks empty release gate, multiple skills, and discovery hazards", async () => {
  const root = await mkdtemp(join(tmpdir(), "prismatic-skills-test-"));
  roots.push(root);
  assert.ok((await check(root)).errors.length > 0);
  await mkdir(join(root, "skills"));
  assert.deepEqual(await check(root), { errors: [], count: 0 });
  assert.ok((await check(root, true)).errors.length > 0);
  for (const name of ["prismatic-check", "prismatic-build"]) {
    const directory = join(root, "skills", name);
    await mkdir(directory);
    await writeFile(
      join(directory, "SKILL.md"),
      valid.replace("prismatic-check", name),
    );
  }
  assert.deepEqual(await check(root, true), { errors: [], count: 2 });
  await writeFile(join(root, "SKILL.md"), valid);
  assert.ok((await check(root)).errors.join().includes("Root SKILL.md"));
  await rm(join(root, "SKILL.md"));
  const nested = join(root, "skills/prismatic-check/nested");
  await mkdir(nested);
  await writeFile(join(nested, "SKILL.md"), valid);
  assert.ok((await check(root)).errors.join().includes("nested skill"));
  await rm(nested, { recursive: true });
  await rm(join(root, "skills/prismatic-check/SKILL.md"));
  assert.ok((await check(root)).errors.join().includes("missing SKILL.md"));
});
