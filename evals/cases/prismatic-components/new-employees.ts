import { resolve } from "node:path";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "new-employees",
  service: "the supplied employee API",
  fixture: resolve(import.meta.dirname, "../../fixtures/specs/employees"),
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
    "JSON code inputs with parsing and structured inputs are equally valid; do not prefer or require either layout. Grade the actual request and response against the supplied employee API: base https://api.example.com/v1, header API key X-API-Key, POST /employees, HTTP201 Employee response. The request requires top-level name:string and address:object; address's street/city/country properties are optional strings. Optional metadata is an arbitrary JSON object: nested booleans, numbers, and arrays must remain typed, and blank metadata must be omitted. For structuredObject inputs, Spectral excludes the container required flag; do not demand that unsupported flag or require optional address children. These metadata distinctions do not change the required API request body.",
  criteria: [
    {
      id: "nested-contract",
      criteria:
        "JSON code inputs with parsing and structured inputs are equally valid; judge behavior without an input-layout preference. The registered action POSTs /employees with name and a nested address object, using the configured connection's X-API-Key. Optional metadata preserves object, boolean, number, and array values and is omitted when blank, rather than sent as an empty string or stringified object. Clear JSON input instructions/examples are sufficient designer configuration; structured child fields are not required.",
    },
  ],
});
