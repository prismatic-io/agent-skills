import { resolve } from "node:path";
import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "edit-dynamic-input",
  service: "Partner Records",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../fixtures/components/records"),
  request:
    "Add one Create Record action to the existing Partner Records connector. Choosing Person should show first name, last name, and email; choosing Company should instead show company name and website. I want the relevant fields to change in the designer, without writing JSON. Keep the existing Create Person action working. API.md has the request formats.",
  persona:
    "You are a low-code integration builder. You want one action with a choice of record type and only the fields for that type. Existing integrations use Create Person. No live account is available; publish a sandbox copy for review.",
  operations: [
    "one new Create Record action supporting Person and Company through a dynamic object input",
  ],
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
