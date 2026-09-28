import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { EditCheck } from "./_check-edit.ts";
import { contact, object, schemaAccepts } from "./_check-edit.ts";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "edit-output-schema",
  service: "Partner Records",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/components/records"),
  request:
    "Our existing Partner Records connector is in this directory, with its API contract in API.md. Get Contact works, but builders cannot see its output fields until they execute it. Make the fields available beforehand in the low-code designer, including its address, tags, and optional email. Keep the output and existing integrations working as they do now.",
  persona:
    "You use the low-code designer and want to map contact fields before running the integration. You do not write code and have no live partner credentials. Publish a sandbox copy for review. Existing integrations and baseline tests must keep working.",
  operations: ["Get Contact with output fields discoverable before execution"],
  apiFailure: false,
  preserved: [
    "all existing connection/action keys, input keys, runtime outputs, branch routing, and API failure behavior",
  ],
  criteria: [
    {
      id: "contact-output-schema",
      criteria:
        "Get Contact declares a valid Spectral action output schema for its data payload, not the surrounding {data} result. It describes nested address fields, string-array tags, boolean active, and optional email accurately against API.md. The schema is present in the compiled component's metadata, not merely a comment, example result, or unused constant. Runtime responses remain unmodified, including absent email.",
    },
  ],
  tests: [],
  tags: ["edit", "output-schema", "metadata"],
});

export const check: EditCheck = {
  kind: "actions",
  member: () => "getContact",
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
