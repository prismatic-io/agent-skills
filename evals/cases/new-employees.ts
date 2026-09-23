import { resolve } from "node:path";
import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "new-employees",
  service: "the supplied employee API",
  fixture: resolve(import.meta.dirname, "../fixtures/specs/employees"),
  request:
    "Build a connector from openapi.json that creates an employee with their address. Sometimes I also attach arbitrary metadata; when I leave metadata blank it should not be sent. I have an API key to configure later. This only needs one action.",
  persona:
    "You build integrations in Prismatic’s low-code designer and do not write code. You want the requested connector, have no architectural preferences, and can supply real service credentials later. Use mocked service calls now and publish only to the authenticated Prismatic sandbox. The supplied service contract is the source of truth for this exercise.",
  operations: ["create an employee with nested address and optional metadata"],
  tests: [
    "request contains the configured X-API-Key header",
    "address remains a nested object and supplied metadata preserves non-string values",
    "blank metadata is absent from the request body",
  ],
  tags: ["openapi", "api-key", "nested-input"],
  contract:
    "Authoritative supplied employee contract: base https://api.example.com/v1, global header API key named X-API-Key. POST /employees accepts required name:string and address:object containing street/city/country string fields, plus optional metadata:object. Metadata is arbitrary JSON object data, so nested booleans, numbers, and arrays must remain typed; blank metadata must be omitted. HTTP201 returns an Employee object. JSON code inputs with parsing are valid for address and metadata; structured inputs are not required.",
  criteria: [
    {
      id: "nested-contract",
      criteria:
        "The registered action POSTs /employees with name and a nested address object. A configured connection supplies X-API-Key. Optional metadata accepts an object, preserves booleans/numbers/arrays, and is omitted when blank, rather than sent as an empty string or stringified object. A JSON input with clear instructions is acceptable; structured inputs are not required.",
    },
  ],
});
