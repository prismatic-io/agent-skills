import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverCases } from "@prismatic-io/lux";
import { test } from "vitest";

test("Lux discovers the embedded cases with colocated local verification", async () => {
  const discovery = await discoverCases(resolve(import.meta.dirname, ".."));
  assert.deepEqual(discovery.problems, []);
  discovery.cases = discovery.cases.filter((entry) =>
    entry.id.startsWith("prismatic-embedded/"),
  );
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
    assert.equal(local.requiresExecutionWorkspace, true);
    assert.equal(local.timeout, "15 minutes");
    const platform = spec.assertions.find(
      (item: { id: string }) => item.id === "platform-scope",
    );
    assert.equal(platform.evidence.view, "execution");
    assert.doesNotMatch(
      String(platform.guidance ?? ""),
      /source-focused evidence/,
    );
    assert.match(platform.criteria, /without replacing existing keys/);
    const verification = spec.assertions.find(
      (item: { id: string }) => item.id === "meaningful-tests",
    );
    assert.equal(verification.informational, true);
    assert.equal(verification.evidence.view, "source");
    const keyCreation = entry.id.endsWith("/create-signing-key");
    assert.deepEqual(local.command, [
      process.execPath,
      checker,
      "--token-path",
      "/api/prismatic/token",
    ]);
    assert.equal(typeof spec.fixtures, "string");
    await access(
      resolve(import.meta.dirname, spec.fixtures, "server", "app.ts"),
    );
    assert.match(spec.prompt, /prismatic-embedded\/SKILL\.md/);
    assert.doesNotMatch(
      spec.prompt,
      /Prism is installed at|check that executable's version/,
    );
    assert.match(
      spec.prompt,
      keyCreation
        ? /create our signing key/
        : /existing signing key|existing keys/i,
    );
  }
});
