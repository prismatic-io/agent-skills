import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverCases } from "@prismatic-io/lux";
import { test } from "vitest";

test("Lux discovers twelve CNI cases with colocated local verification", async () => {
  const discovery = await discoverCases(import.meta.dirname);
  assert.deepEqual(discovery.problems, []);
  assert.equal(discovery.cases.length, 12);
  const checker = resolve(import.meta.dirname, "_verify-generated-cni.mjs");
  await access(checker);
  const modes = { create: 0, edit: 0 };
  for (const entry of discovery.cases) {
    assert.ok(entry.id.startsWith("prismatic-build-integration/"));
    const { default: spec } = await import(pathToFileURL(entry.path).href);
    const local = spec.assertions.find(
      (item: { id: string }) => item.id === "local-checks",
    );
    assert.equal(local.command, `node '${checker}'`);
    assert.equal(local.type, "command-exits-zero");
    modes[spec.meta.tags.includes("edit") ? "edit" : "create"]++;
  }
  assert.deepEqual(modes, { create: 6, edit: 6 });
});
