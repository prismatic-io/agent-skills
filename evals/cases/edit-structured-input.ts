import { resolve } from "node:path";
import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "edit-structured-input",
  service: "Partner Records",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../fixtures/components/records"),
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
