import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Component, EditCheck, Json } from "./_check-edit.ts";
import {
  baselineActions,
  child,
  fields,
  object,
  setValue,
  walkInputs,
} from "./_check-edit.ts";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "edit-structured-input",
  service: "Partner Records",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/components/records"),
  request:
    "Add a new action to our existing Partner Records connector for creating an employee. Builders should enter a name and fill in the grouped address fields rather than write JSON. Let them optionally supply the metadata external ID too. Keep the existing Create Employee action because current integrations use it. The small API contract is in API.md.",
  persona:
    "You build integrations in the designer. You want a grouped address editor with named fields and no JSON authoring. Existing integrations still use the old JSON action. No live account is available; publish a sandbox copy for review.",
  operations: [
    "a new Create Employee action with a structured address input and optional metadata",
  ],
  preserved: [
    "the original createEmployee action, employeeJson input, all other existing actions, and apiKey connection",
  ],
  criteria: [
    {
      id: "structured-address",
      criteria:
        "A separately registered new action exposes a genuine Spectral structured object input for address (street, city, country), plus name and optional metadata external ID, without requiring JSON. Its POST /employees body matches API.md, with metadata omitted when absent. Defining three unrelated flat address strings or relabeling a JSON input is insufficient. The legacy action remains callable with its original employeeJson input.",
    },
  ],
  tests: [
    "new action sends the nested address body with metadata",
    "new action omits metadata when not supplied",
    "legacy JSON action still works",
  ],
  tags: ["edit", "structured-input", "compatibility"],
});

export const check: EditCheck = {
  kind: "actions",
  member: (component: Component) =>
    Object.entries(component.actions).find(
      ([key, action]) =>
        !baselineActions.has(key) &&
        action.inputs.some(({ type }) => type === "structuredObject"),
    )?.[0],
  feature: async ({ component, harness, connection, calls }) => {
    const added = Object.entries(component.actions).filter(
      ([key]) => !baselineActions.has(key),
    );
    const match = added.find(([, action]) =>
      walkInputs(action.inputs).some(
        ({ input }) =>
          input.type === "structuredObject" &&
          child(input.inputs ?? [], "street"),
      ),
    );
    assert.ok(match, "No added action exposes a structured address");
    const [key, action] = match;
    const inputs = walkInputs(action.inputs);
    const address = inputs.find(
      ({ input }) =>
        input.type === "structuredObject" &&
        child(input.inputs ?? [], "street"),
    );
    const name = inputs.find(({ input }) => child([input], "name"));
    assert.ok(address && name, "Missing address or name fields");
    // New input keys are implementation choices. Identify the optional
    // metadata field by its registered behavior, not a particular spelling.
    const candidates = inputs.filter(
      ({ input, path }) =>
        input.type === "string" &&
        !input.required &&
        input !== name.input &&
        input.key !== "connection" &&
        !address.path.every((part, index) => path[index] === part),
    );
    const addressValue = {
      street: "1 Main St",
      city: "London",
      country: "GB",
    };
    const failures: string[] = [];
    let matched = false;
    for (const externalId of candidates) {
      try {
        for (const value of ["external-1", "partner/second-id", undefined]) {
          const params: Json = { connection };
          setValue(params, name.path, "Ada");
          setValue(
            params,
            address.path,
            fields(address.input.inputs ?? [], addressValue),
          );
          if (value !== undefined) setValue(params, externalId.path, value);
          const expected = {
            name: "Ada",
            address: addressValue,
            ...(value !== undefined ? { metadata: { externalId: value } } : {}),
          };
          const before = calls.length;
          const result = object(await harness.action(key, params));
          const writes = calls
            .slice(before)
            .filter(
              ({ method }) => !["GET", "HEAD", "OPTIONS"].includes(method),
            );
          assert.equal(writes.length, 1, "Expected exactly one creation write");
          assert.deepEqual(writes[0].body, expected);
          assert.equal(writes[0].method, "POST");
          assert.equal(writes[0].path, "/employees");
          assert.deepEqual(result.data, { id: "created", ...expected });
        }
        matched = true;
        break;
      } catch (error) {
        failures.push(`${externalId.path.join(".")}: ${String(error)}`);
      }
    }
    assert.ok(
      matched,
      `No optional designer input correctly supplies metadata.externalId and omits metadata when unset. ${failures.join("; ")}`,
    );
  },
};
