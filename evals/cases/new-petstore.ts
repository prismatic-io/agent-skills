import { resolve } from "node:path";
import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "new-petstore",
  service: "the supplied Petstore API",
  fixture: resolve(import.meta.dirname, "../fixtures/specs/petstore"),
  request:
    "Build a connector from openapi.yaml so I can list pets with an optional result limit, create a pet, and retrieve a pet by its ID. I only need these three actions. Use the supplied version of the API.",
  persona:
    "You build integrations in Prismatic’s low-code designer and do not write code. You want the requested connector, have no architectural preferences, and can supply real service credentials later. Use mocked service calls now and publish only to the authenticated Prismatic sandbox. The supplied service contract is the source of truth for this exercise.",
  operations: [
    "list pets with an optional limit",
    "create a pet",
    "get a pet by ID",
  ],
  tests: [
    "list sends a numeric limit when supplied and omits it when blank",
    "create sends the required pet fields and handles a successful empty 201 response",
    "get substitutes and encodes the supplied ID and returns that pet",
  ],
  tags: ["openapi", "rest", "empty-response"],
  contract:
    "Authoritative supplied Petstore contract: base http://petstore.swagger.io/v1, no authentication. GET /pets accepts optional integer query limit (max 100) and returns a Pet array. POST /pets accepts JSON {id: integer, name: string, tag?: string}; success is HTTP 201 with an empty body. Optional tag may be omitted or supplied as an empty string; the schema imposes no nonempty constraint. GET /pets/{petId} accepts an opaque string path ID and returns one Pet. Errors are non-2xx with {code: integer, message: string}. Preserve these shapes; a user-configurable base URL connection without credentials is allowed.",
  criteria: [
    {
      id: "spec-contract",
      criteria:
        "Calls conform to the supplied OpenAPI: GET /pets, POST /pets with a JSON pet including id and name, GET /pets/{petId}. Create success is an empty 201, so unconditional JSON parsing must not fail. No invented authorization requirement. Judge the implementation semantics independently of test coverage; Axios JSON response mode alone does not imply unconditional JSON.parse. No particular generator, library, file layout or action key is required.",
    },
  ],
});
