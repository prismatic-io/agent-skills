import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Build a connector from openapi.json that creates an employee with their address. Sometimes I also attach arbitrary metadata; when I leave metadata blank it should not be sent. I have an API key to configure later. This only needs one action.",
  ),
  fixtures: "../../fixtures/specs/employees",
  assertions: [
    {
      type: "rubric",
      id: "nested-contract",
      criteria:
        "The requested actions are implemented and registered as usable Spectral actions. JSON code inputs with parsing and structured inputs are equally valid; judge behavior without an input-layout preference. The registered action POSTs /employees with name and a nested address object, using the configured connection's X-API-Key. Optional metadata preserves object, boolean, number, and array values and is omitted when blank, rather than sent as an empty string or stringified object. Clear JSON input instructions/examples are sufficient designer configuration; structured child fields are not required. The supplied API base is https://api.example.com/v1 and create succeeds with HTTP 201 Employee. Name and address are required; address street/city/country are optional strings. Spectral excludes the structuredObject container required flag: do not require that flag or optional address children.",
    },
  ],
});
