import assert from "node:assert/strict";
import { resolve } from "node:path";
import { discoverCases, RubricConfigSchema } from "@prismatic-io/lux";
import { test } from "vitest";

const discovery = await discoverCases(import.meta.dirname);
assert.deepEqual(discovery.problems, []);
const cases = await Promise.all(
  discovery.cases.map(async ({ path, id }) => ({
    ...(await import(path)).default,
    id,
  })),
);
const find = (id: string) => {
  const spec = cases.find((entry) => entry.id === id);
  assert.ok(spec, id);
  return spec;
};

test("component cases keep publication scope and restrictions in truncated permission context", () => {
  assert.equal(cases.length, 13);
  for (const spec of cases) {
    const prefix = Buffer.from(spec.prompt).subarray(0, 397).toString();
    assert.match(prefix, /mocked service calls/);
    assert.match(prefix, /Publish a new review copy/);
    assert.match(prefix, /our Prismatic organization/);
    assert.match(prefix, /leave it for review/i);
    assert.match(
      prefix,
      /without changing other components or live service accounts\./,
    );
    assert.equal(
      spec.assertions.filter((a: { id: string }) => a.id === "completed")
        .length,
      1,
    );
  }
});

test("documentation fixtures do not imply component edits", () => {
  const spec = find("new-employees");
  assert.equal(typeof spec.fixtures, "string");
  assert.match(spec.prompt, /Build a connector from openapi.json/);
  const check = spec.assertions.find(
    (a: { id: string }) => a.id === "component-checks",
  );
  assert.equal(check.command.length, 2);
});

test("every component edit runs its authored behavioral check against its own baseline", () => {
  for (const spec of cases.filter((entry) => entry.id.startsWith("edit-"))) {
    assert.match(spec.prompt, /Preserve existing integrations/);
    const check = spec.assertions.find(
      (a: { id: string }) => a.id === "component-checks",
    );
    assert.equal(check.requiresExecutionWorkspace, true);
    assert.deepEqual(check.env, { CI: "true" });
    assert.equal(check.timeout, "10 minutes");
    assert.deepEqual(check.command, [
      process.execPath,
      resolve(import.meta.dirname, "_check-component.ts"),
      "--baseline",
      resolve(import.meta.dirname, spec.fixtures),
      "--case",
      resolve(import.meta.dirname, `${spec.id.split("/").at(-1)}.ts`),
    ]);
    assert.ok(
      spec.assertions.some(
        (a: { id: string }) => a.id === "backward-compatibility",
      ),
    );
  }
});

test("metadata-only checks remain independent without redundant authored test requirements", () => {
  const spec = find("edit-output-schema");
  assert.ok(
    spec.assertions.some(
      (a: { id: string }) => a.id === "contact-output-schema",
    ),
  );
  assert.ok(
    !spec.assertions.some((a: { id: string }) => a.id === "meaningful-tests"),
  );
  const tested = find("new-employees").assertions.find(
    (a: { id: string }) => a.id === "meaningful-tests",
  );
  assert.equal(tested.informational, true);
  assert.match(tested.criteria, /registered actions or triggers/);
  assert.match(tested.criteria, /without a fixed test inventory/);
});

test("service contracts stay in their implementation criteria", () => {
  const spec = find("new-employees");
  const implementation = spec.assertions.find(
    (a: { id: string }) => a.id === "nested-contract",
  );
  assert.match(implementation.criteria, /https:\/\/api.example.com\/v1/);
  assert.doesNotMatch(spec.prompt, /Spectral excludes/);
  assert.doesNotMatch(spec.persona, /Spectral excludes/);
  for (const id of ["platform-scope", "nondeveloper-experience"]) {
    const assertion = spec.assertions.find((a: { id: string }) => a.id === id);
    assert.doesNotMatch(
      assertion.guidance ?? "",
      /Spectral excludes|api.example.com/,
    );
  }
  assert.doesNotMatch(
    spec.prompt + spec.persona,
    /Spectral excludes|api.example.com/,
  );
});

test("component evidence matches each grader's responsibility", () => {
  for (const spec of cases) {
    for (const assertion of spec.assertions) {
      if (assertion.type !== "rubric") continue;
      const parsed = RubricConfigSchema.parse(assertion);
      if (
        ["platform-scope", "trigger", "documentation-accuracy"].includes(
          assertion.id,
        )
      ) {
        assert.ok(parsed.evidence.eventTypes.includes("tool-result"));
      }
      if (assertion.id === "nondeveloper-experience") {
        assert.equal(parsed.informational, true);
        assert.deepEqual(parsed.evidence.artifactPatterns, ["**/*.md"]);
      }
    }
  }
});
