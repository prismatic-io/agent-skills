import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverCases } from "@prismatic-io/lux";
import { test } from "vitest";
import { prismBin } from "../../prism.ts";

test("Lux discovers the embedded cases with colocated local verification", async () => {
  const discovery = await discoverCases(import.meta.dirname);
  assert.deepEqual(discovery.problems, []);
  assert.deepEqual(discovery.cases.map((entry) => entry.id).sort(), [
    "prismatic-embedded/browser-signing-request",
    "prismatic-embedded/create-signing-key",
    "prismatic-embedded/marketplace-settings",
    "prismatic-embedded/match-app-theme",
  ]);
  const checker = resolve(import.meta.dirname, "_verify-embedded-app.mjs");
  await access(checker);
  for (const entry of discovery.cases) {
    const { default: spec } = await import(pathToFileURL(entry.path).href);
    const local = spec.assertions.find(
      (item: { id: string }) => item.id === "local-checks",
    );
    assert.equal(local.type, "command-exits-zero");
    const keyCreation = entry.id.endsWith("/create-signing-key");
    assert.equal(
      local.command,
      `node '${checker}' --token-path '/api/prismatic/token'`,
    );
    assert.ok(spec.meta.tags.includes("embedded-skill"));
    assert.equal(spec.fixtures.kind, "dir");
    await access(resolve(spec.fixtures.path, "server", "app.ts"));
    assert.match(spec.prompt, /prismatic-embedded\/SKILL\.md/);
    assert.ok(
      spec.prompt.includes(
        `Prism is installed at ${resolve(prismBin, "prism")};`,
      ),
    );
    assert.match(
      spec.prompt,
      keyCreation
        ? /Creating the signing key requested above is authorized/
        : /Do not call Prismatic APIs/,
    );
  }
});
