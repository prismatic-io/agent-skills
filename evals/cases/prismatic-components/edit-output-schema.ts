import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { EditCheck } from "./_check-edit.ts";
import { contact, object, schemaAccepts } from "./_check-edit.ts";
import * as suite from "./_suite.ts";

export default suite.defineCase({
  omitAssertions: ["meaningful-tests"],
  prompt: suite.prompt(
    "Our existing Partner Records connector is in this directory, with its API contract in API.md. Get Contact works, but builders cannot see its output fields until they execute it. Make the fields available beforehand in the low-code designer, including its address, tags, and optional email. Keep the output and existing integrations working as they do now.",
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
        resolve(import.meta.dirname, "edit-output-schema.ts"),
      ),
    },
    {
      type: "rubric",
      id: "contact-output-schema",
      criteria:
        "Get Contact declares a valid Spectral action output schema for its data payload, not the surrounding {data} result. It describes nested address fields, string-array tags, boolean active, and optional email accurately against API.md. The schema is present in the compiled component's metadata, not merely a comment, example result, or unused constant. Runtime responses remain unmodified, including absent email.",
    },
    {
      ...suite.compatibility,
      criteria:
        "all existing connection/action keys, input keys, runtime outputs, branch routing, and API failure behavior",
    },
  ],
});

export const check: EditCheck = {
  feature: async ({ component, harness, connection, calls }) => {
    const schema = component.actions.getContact.outputSchema;
    assert.equal(
      schema?.type,
      "actionOutput",
      "Missing registered action output schema",
    );
    assert.ok(schema?.type === "actionOutput");
    schemaAccepts(
      schema.schema,
      [contact, { ...contact, email: "ada@example.test" }],
      [
        { data: contact },
        { ...contact, active: "false" },
        { ...contact, tags: [1] },
        { ...contact, email: 2 },
        { ...contact, id: 2 },
        { ...contact, name: false },
        { ...contact, address: { city: 2, country: "GB" } },
        { ...contact, address: { city: "London", country: false } },
      ],
    );
    assert.deepEqual(
      object(
        await harness.action("getContact", { connection, contactId: "c/1" }),
      ).data,
      contact,
    );
    assert.equal(calls[0].path, "/contacts/c%2F1");
  },
};
