import assert from "node:assert/strict";
import { resolve } from "node:path";
import { discoverCases } from "@prismatic-io/lux";
import { test } from "vitest";
import {
  type ComponentCase,
  componentAssertions,
  defineComponentCase,
} from "./_component-case.ts";

const base: ComponentCase = {
  id: "harness-test",
  service: "Example API",
  request: "Build a connector that retrieves a contact.",
  persona: "I build integrations in the low-code designer.",
  operations: ["get a contact"],
  tests: ["the requested contact is retrieved"],
};

const rubricText = (spec: ComponentCase, id: string) => {
  const assertion = componentAssertions(spec).find((entry) => entry.id === id);
  assert.ok(assertion, `Missing assertion ${id}`);
  assert.equal(assertion.type, "rubric");
  return "criteria" in assertion ? String(assertion.criteria) : "";
};

test("truncated permission context retains publication scope and restrictions together", () => {
  for (const mode of ["create", "edit"] as const) {
    const result = defineComponentCase({
      ...base,
      id: "edit-webhook-listening",
      mode,
      fixture: resolve(import.meta.dirname, "../../fixtures/contact-example"),
    });
    // Grok's native classifier retains 397 bytes plus an ellipsis per turn.
    const prefix = Buffer.from(result.prompt).subarray(0, 397).toString();
    assert.match(prefix, /mocked service calls/);
    assert.match(prefix, /Publish only a fresh edit-webhook-listening-lux-\*/);
    assert.match(prefix, /authenticated Prismatic sandbox/);
    assert.match(prefix, /leave it for review/);
    assert.match(
      prefix,
      /Do not change other components or live service accounts\./,
    );
    assert.ok(result.prompt.includes(base.request));
  }
});

test("a spec fixture does not turn a creation case into an edit case", () => {
  const fixture = resolve(import.meta.dirname, "../../fixtures/spec-example");
  const result = defineComponentCase({ ...base, fixture, mode: "create" });
  assert.deepEqual(result.fixtures, { kind: "dir", path: fixture });
  assert.ok(Array.isArray(result.meta?.tags));
  assert.ok(!result.meta.tags.includes("continuation"));
  assert.doesNotMatch(
    result.prompt,
    /preserve .*existing.*(?:action|trigger).*keys/i,
  );
});

test("edit cases use their own fixture and preserve member keys while publishing a fresh component", () => {
  const fixture = resolve(
    import.meta.dirname,
    "../../fixtures/contact-example",
  );
  const result = defineComponentCase({
    ...base,
    fixture,
    mode: "edit",
    preserved: ["getContact", "apiKey"],
  });
  assert.deepEqual(result.fixtures, { kind: "dir", path: fixture });
  assert.match(result.prompt, /(?:existing|seeded) component/i);
  assert.match(
    result.prompt,
    /(?:preserv|retain|keep)[\s\S]*(?:keys|identit)/i,
  );
  assert.match(result.prompt, /(?:fresh|unique)[\s\S]*harness-test-lux-/i);
  const criteria = componentAssertions({
    ...base,
    fixture,
    mode: "edit",
    preserved: ["getContact", "apiKey"],
  })
    .filter((entry) => entry.type === "rubric")
    .map((entry) => ("criteria" in entry ? entry.criteria : ""))
    .join("\n");
  assert.match(criteria, /getContact/);
  assert.match(criteria, /apiKey/);
});

test("the legacy continuation override cannot silently replace an authored fixture", () => {
  const previous = process.env.PRISM_EVAL_FIXTURE;
  process.env.PRISM_EVAL_FIXTURE = "/tmp/unrelated-component";
  try {
    assert.throws(
      () =>
        defineComponentCase({
          ...base,
          fixture: resolve(
            import.meta.dirname,
            "../../fixtures/contact-example",
          ),
          mode: "edit",
        }),
      /fixture|override|continuation/i,
    );
  } finally {
    if (previous === undefined) delete process.env.PRISM_EVAL_FIXTURE;
    else process.env.PRISM_EVAL_FIXTURE = previous;
  }
});

test("the broad original case retains its seven independent checks", () => {
  assert.deepEqual(
    componentAssertions({
      ...base,
      trigger: "detect changed contacts",
      facts: "The API supports contact webhooks.",
    }).map(({ id }) => id),
    [
      "completed",
      "component-checks",
      "requested-operations",
      "trigger",
      "documentation-accuracy",
      "meaningful-tests",
      "nondeveloper-experience",
    ],
  );
  assert.match(rubricText(base, "meaningful-tests"), /API failure/i);
});

test("metadata edits require behavioral tests without inventing an API failure requirement", () => {
  const criteria = rubricText(
    {
      ...base,
      mode: "edit",
      apiFailure: false,
      tests: [
        "the unchanged contact payload matches the declared output schema",
      ],
    },
    "meaningful-tests",
  );
  assert.match(criteria, /unchanged contact payload/);
  assert.doesNotMatch(
    criteria,
    /and an API failure|API failure test is sufficient/i,
  );
  assert.match(criteria, /implementation|behavior/i);
});

test("case-specific checks remain separate from general operation grading", () => {
  const criteria =
    "The schema describes data itself, not the enclosing result.";
  const assertions = componentAssertions({
    ...base,
    criteria: [{ id: "payload-schema", criteria }],
  });
  assert.ok(assertions.some(({ id }) => id === "requested-operations"));
  const targeted = assertions.find(({ id }) => id === "payload-schema");
  assert.ok(targeted && "criteria" in targeted);
  assert.match(String(targeted.criteria), /schema describes data itself/);
});

test("metadata-only cases retain independent verification without mandating mirror unit tests", () => {
  const assertions = componentAssertions({
    ...base,
    mode: "edit",
    tests: [],
    criteria: [
      {
        id: "registered-metadata",
        criteria:
          "The registered output schema exposes correct fields and types.",
      },
    ],
  });
  assert.ok(!assertions.some(({ id }) => id === "meaningful-tests"));
  assert.ok(
    assertions.some(
      ({ id, type }) =>
        id === "component-checks" && type === "command-exits-zero",
    ),
  );
  assert.ok(
    assertions.some(
      ({ id, type }) => id === "registered-metadata" && type === "rubric",
    ),
  );
  assert.ok(
    componentAssertions(base).some(({ id }) => id === "meaningful-tests"),
  );
});

test("edit command passes the authored case path to the generic checker", () => {
  const fixture = resolve(
    import.meta.dirname,
    "../../fixtures/contact-example",
  );
  const assertions = componentAssertions({
    ...base,
    id: "edit-output-schema",
    fixture,
    mode: "edit",
  });
  const command = assertions.find((entry) => entry.id === "component-checks");
  assert.ok(command && command.type === "command-exits-zero");
  assert.equal(command.requiresExecutionWorkspace, true);
  assert.match(command.command, /_check-component\.ts/);
  assert.match(command.command, /--case .*edit-output-schema\.ts/);
  assert.doesNotMatch(command.command, /--case-id/);
});

test("Lux discovers component cases without underscore-prefixed helpers", async () => {
  const root = resolve(import.meta.dirname, "..");
  const discovery = await discoverCases(root);
  assert.deepEqual(discovery.problems, []);
  const components = discovery.cases.filter((entry) =>
    entry.id.startsWith("prismatic-components/"),
  );
  assert.equal(components.length, 13);
  assert.ok(
    components.every((entry) =>
      entry.relPath.startsWith("prismatic-components/"),
    ),
  );
  assert.ok(
    components.every((entry) => !entry.path.split("/").at(-1)?.startsWith("_")),
  );
});
