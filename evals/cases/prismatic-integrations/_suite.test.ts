import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverCases } from "@prismatic-io/lux";
import { test } from "vitest";

test("Lux discovers thirteen CNI cases with native local verification", async () => {
  const discovery = await discoverCases(resolve(import.meta.dirname, ".."));
  assert.deepEqual(discovery.problems, []);
  discovery.cases = discovery.cases.filter((entry) =>
    entry.id.startsWith("prismatic-integrations/"),
  );
  assert.equal(discovery.cases.length, 13);
  const checker = resolve(import.meta.dirname, "../_verify-cni.mjs");
  await access(checker);
  for (const entry of discovery.cases) {
    assert.ok(entry.id.startsWith("prismatic-integrations/"));
    const { default: spec } = await import(pathToFileURL(entry.path).href);
    const local = spec.assertions.find(
      (item: { id: string }) => item.id === "local-checks",
    );
    assert.deepEqual(local.command, [process.execPath, checker]);
    assert.equal(local.type, "command-exits-zero");
    assert.equal(local.requiresExecutionWorkspace, true);
    assert.equal(local.timeout, "10 minutes");
    const verification = spec.assertions.find(
      (item: { id: string }) => item.id === "meaningful-tests",
    );
    assert.equal(verification.informational, true);
    assert.equal(verification.evidence.view, "source");
    assert.match(verification.criteria, /meaningful authored tests/);
    for (const id of ["handoff", "platform-publication"]) {
      const assertion = spec.assertions.find(
        (item: { id: string }) => item.id === id,
      );
      assert.equal(assertion.evidence.view, "execution");
      assert.doesNotMatch(
        String(assertion.guidance ?? ""),
        /source-focused evidence/,
      );
    }
  }
});
