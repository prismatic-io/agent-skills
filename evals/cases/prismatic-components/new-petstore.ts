import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Build a connector from openapi.yaml so I can list pets with an optional result limit, create a pet, and retrieve a pet by its ID. I only need these three actions. Use the supplied version of the API.",
  ),
  fixtures: "../../fixtures/specs/petstore",
  assertions: [
    {
      type: "rubric",
      id: "spec-contract",
      criteria:
        "The requested actions are implemented and registered as usable Spectral actions. Calls conform to the supplied OpenAPI: GET /pets, POST /pets with a JSON pet including id and name, GET /pets/{petId}. Create success is an empty 201, so unconditional JSON parsing must not fail. No invented authorization requirement. Judge the implementation semantics independently of test coverage; Axios JSON response mode alone does not imply unconditional JSON.parse. No particular generator, library, file layout or action key is required. The supplied base is http://petstore.swagger.io/v1; a configurable base URL without credentials is valid. GET /pets accepts optional integer limit up to 100 and returns a Pet array. Creation requires integer id and string name; optional tag may be omitted or empty. GET /pets/{petId} accepts an opaque string and returns one Pet. Non-2xx errors contain {code:integer,message:string}.",
    },
  ],
});
