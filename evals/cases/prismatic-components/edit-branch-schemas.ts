import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { EditCheck } from "./_check-edit.ts";
import { object, schemaAccepts, schemaPropertyNames } from "./_check-edit.ts";
import * as suite from "./_suite.ts";

export default suite.defineCase({
  omitAssertions: ["meaningful-tests"],
  prompt: suite.prompt(
    "The existing Partner Records connector has a Review Contact action that takes Approved or Rejected branches. Builders need to see the appropriate fields on each branch before running it: approval time for Approved, and reason plus whether it can be retried for Rejected. Add that capability without changing routing or the returned data. API.md describes the service.",
  ),
  fixtures: "../../fixtures/components/records",
  assertions: [
    {
      id: "component-checks",
      type: "command-exits-zero",
      command: suite.componentCommand(
        "--baseline",
        resolve(import.meta.dirname, "../../fixtures/components/records"),
        "--case",
        resolve(import.meta.dirname, "edit-branch-schemas.ts"),
      ),
    },
    {
      ...suite.operations,
      criteria:
        "Review Contact with distinct discoverable fields for Approved and Rejected. Spectral 10.30 public types define authoring outputSchema as { type: 'branchingOutput', branchSchemas: Record<string, JsonSchema> }. The SDK converts that source map into the registered component’s branchSchemas array of { name, schema: JSON string }. Judge the authored declaration against the public authoring API, not the compiled server representation. Independent component-checks verify the compiled representation plus routing and payloads. The platform rubric checks published metadata.",
    },
    {
      ...suite.compatibility,
      criteria:
        "all existing action/connection/input keys, exact Approved and Rejected branch names, payload shapes, and routing",
    },
  ],
});

export const check: EditCheck = {
  feature: async ({ component, harness, connection, controls }) => {
    const action = component.actions.reviewContact;
    assert.deepEqual([...(action.staticBranchNames ?? [])].sort(), [
      "Approved",
      "Rejected",
    ]);
    const schema = action.outputSchema;
    assert.ok(
      schema?.type === "branchingOutput",
      "Missing branch output schemas",
    );
    assert.deepEqual(schema.branchSchemas.map(({ name }) => name).sort(), [
      "Approved",
      "Rejected",
    ]);
    const approved = { contactId: "c/1", approvedAt: "2026-01-02T03:04:05Z" };
    const rejected = {
      contactId: "c/1",
      reason: "Missing consent",
      retryable: false,
    };
    for (const [name, valid] of [
      ["Approved", approved],
      ["Rejected", rejected],
    ] as const) {
      const branch: { name: string; schema: string } | undefined =
        schema.branchSchemas.find((entry) => entry.name === name);
      assert.ok(branch);
      assert.deepEqual(
        schemaPropertyNames(object(JSON.parse(branch.schema))).sort(),
        Object.keys(valid).sort(),
        "Branch must expose its own data fields, without a result wrapper or the other branch's fields",
      );
      schemaAccepts(
        branch.schema,
        [valid],
        [
          { ...valid, contactId: 1 },
          name === "Rejected"
            ? { ...valid, retryable: "false" }
            : { ...valid, approvedAt: 1 },
          ...(name === "Rejected" ? [{ ...valid, reason: 1 }] : []),
        ],
      );
      controls.rejectReview = name === "Rejected";
      const result = object(
        await harness.action("reviewContact", {
          connection,
          contactId: "c/1",
        }),
      );
      assert.equal(result.branch, name);
      assert.deepEqual(result.data, valid);
    }
  },
};
