import assert from "node:assert/strict";
import { resolve } from "node:path";
import { discoverCases, RubricConfigSchema } from "@prismatic-io/lux";
import { test } from "vitest";

test("all quality rubrics preserve continuous scores independently of acceptance", async () => {
  const discovery = await discoverCases(import.meta.dirname);
  assert.deepEqual(discovery.problems, []);
  assert.ok(discovery.cases.length > 0);
  for (const entry of discovery.cases) {
    const { default: authored } = await import(entry.path);
    assert.doesNotMatch(
      `${authored.prompt}\n${authored.persona ?? ""}`,
      /existing Prism session|Prism's existing authentication|Prism is installed at|check that executable's version|[a-z-]+-lux-\*/i,
      `${entry.id}: session provisioning belongs in the harness`,
    );
    for (const assertion of authored.assertions ?? []) {
      if (assertion.type !== "rubric") continue;
      const label = `${entry.id}: ${assertion.id}`;
      RubricConfigSchema.parse(assertion);
      assert.equal(assertion.scoring, undefined, label);
      assert.doesNotMatch(
        assertion.criteria,
        /return 1 only|award 1 only|award 0 otherwise|must score below|fail this criterion/i,
        label,
      );
      if (assertion.informational) {
        assert.equal(assertion.threshold, undefined, label);
        assert.ok(
          ["meaningful-tests", "nondeveloper-experience"].includes(
            assertion.id,
          ),
          label,
        );
      } else {
        assert.ok((assertion.threshold ?? 0.8) > 0, label);
      }
      if (
        [
          "platform-publication",
          "platform-scope",
          "honest-platform-handoff",
        ].includes(assertion.id)
      ) {
        assert.notEqual(assertion.informational, true, label);
        assert.equal(assertion.scoring, undefined, label);
        assert.equal(assertion.threshold ?? 0.8, 0.8, label);
      }
    }
  }
});

test("signup and authenticated setup are separate requests", async () => {
  const { default: signup } = await import(
    resolve(import.meta.dirname, "orby/signup-guidance.ts")
  );
  const { default: setup } = await import(
    resolve(import.meta.dirname, "orby/setup-existing-org.ts")
  );
  assert.match(signup.prompt, /haven't signed up/);
  assert.doesNotMatch(signup.prompt, /Use the existing Prism session/);
  assert.match(setup.prompt, /already signed up/);
  const { cases } = await discoverCases(import.meta.dirname);
  const ids = cases.filter((entry) =>
    /orby\/(signup-guidance|setup-existing-org)$/.test(entry.id),
  );
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0].id, ids[1].id);
});

test("offline assessment requests stay offline without publication or authenticated discovery coaching", async () => {
  for (const id of ["customer-oauth-handoff", "cutover-order-sync"]) {
    const { default: authored } = await import(
      resolve(import.meta.dirname, `prismatic-migrate/${id}.ts`)
    );
    assert.doesNotMatch(
      authored.prompt,
      /authenticated discovery|inspect (?:the |our )?organization|publish the replacement|import a new review/i,
    );
    assert.ok(
      authored.assertions.every(
        (entry: { type: string }) => entry.type !== "command-exits-zero",
      ),
    );
  }
});
