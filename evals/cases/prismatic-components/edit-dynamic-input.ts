import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Component, EditCheck, Input, Json } from "./_check-edit.ts";
import { baselineActions, fields, object } from "./_check-edit.ts";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "edit-dynamic-input",
  service: "Partner Records",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/components/records"),
  request:
    "Add one Create Record action to the existing Partner Records connector. Choosing Person should show first name, last name, and email; choosing Company should instead show company name and website. I want the relevant fields to change in the designer, without writing JSON. Keep the existing Create Person action working. API.md has the request formats.",
  persona:
    "You are a low-code integration builder. You want one action with a choice of record type and only the fields for that type. Existing integrations use Create Person. No live account is available; publish a separate copy for review.",
  operations: [
    "one new Create Record action supporting Person and Company through a dynamic object input",
  ],
  contract:
    "Spectral dynamic object action inputs use { configuration, values } at the SDK invocation boundary. Tests should pass that wrapper to the registered action. The service HTTP request body must contain the selected fields without that wrapper. Do not confuse the SDK input representation with the outbound API body; accepting the documented wrapper at the action boundary is correct.",
  preserved: [
    "createPerson with its original connection/firstName/lastName/email inputs and output",
    "all other existing action and connection contracts",
  ],
  criteria: [
    {
      id: "dynamic-record-configurations",
      criteria:
        "One registered new action uses Spectral dynamic object input configurations declared for Person and Company so the designer can show the appropriate fields. Person calls POST /people with firstName/lastName/email; Company calls POST /companies with companyName/website. For valid inputs from the selected configuration, the API body contains that configuration's fields without the configuration/values envelope. Forwarding the selected values object is acceptable; sanitizing injected fields outside the declared configuration is not required. A static union of all inputs, two separate replacement actions, or JSON text does not meet the request. The original Create Person action remains usable.",
    },
  ],
  tests: [
    "both Person and Company configurations execute the registered action with the SDK's actual dynamic input value shape",
    "valid Person and Company inputs reach their respective endpoints without the configuration/values envelope",
    "legacy Create Person still works",
  ],
  tags: ["edit", "dynamic-input", "compatibility"],
});

export const check: EditCheck = {
  kind: "actions",
  member: (component: Component) =>
    Object.entries(component.actions).find(
      ([key, action]) =>
        !baselineActions.has(key) &&
        action.inputs.some(({ type }) => type === "dynamicObject"),
    )?.[0],
  feature: async ({ component, harness, connection, calls }) => {
    const added = Object.entries(component.actions).filter(
      ([key]) => !baselineActions.has(key),
    );
    const match = added.find(([, action]) =>
      action.inputs.some((input) => input.type === "dynamicObject"),
    );
    assert.ok(match, "No added action exposes a dynamic object input");
    const [key, action] = match;
    const input = action.inputs.find((entry) => entry.type === "dynamicObject");
    assert.ok(input);
    for (const [kind, expected, endpoint] of [
      [
        "Person",
        { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
        "/people",
      ],
      [
        "Company",
        {
          companyName: "Analytical Engines",
          website: "https://example.test",
        },
        "/companies",
      ],
    ] as const) {
      const configuration: Input | undefined = input.inputs?.find(
        (entry) =>
          entry.key.toLowerCase() === kind.toLowerCase() ||
          entry.label.toLowerCase() === kind.toLowerCase(),
      );
      assert.ok(configuration, `Missing ${kind} configuration`);
      const values = fields(configuration.inputs ?? [], expected);
      const result: Json = object(
        await harness.action(key, {
          connection,
          [input.key]: {
            configuration: configuration.key,
            values,
          },
        }),
      );
      assert.equal(calls.at(-1)?.path, endpoint);
      assert.deepEqual(calls.at(-1)?.body, expected);
      assert.deepEqual(result.data, { id: "created", ...expected });
    }
  },
};
