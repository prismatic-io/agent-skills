import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Build a connector from openapi.json to list available currencies and get the rate for a currency pair. I normally want the latest rate, but sometimes supply a historical date. Keep the date and numeric rate that the service actually returns. These two actions are enough.",
  ),
  fixtures: "../../fixtures/specs/frankfurter",
  assertions: [
    {
      type: "rubric",
      id: "rate-contract",
      criteria:
        "The requested actions are implemented and registered as usable Spectral actions. Use the supplied v2 API, without inventing authentication or depending on v1 response shapes. GET /rate/{base}/{quote} with optional date is the direct pair operation; a documented equivalent query to /rates is acceptable if it unambiguously returns the requested pair. Preserve the returned date even when it differs from the requested date and preserve fractional rates as numbers. Do not replace the returned date with the requested date or assume a latest rate is today’s rate. The supplied base is https://api.frankfurter.dev/v2. GET /currencies returns objects with iso_code and name. The pair response is {date:string,base:string,quote:string,rate:number}; optional date is YYYY-MM-DD and must be omitted for latest. A configurable base URL without credentials is valid.",
    },
  ],
});
