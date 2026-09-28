import { resolve } from "node:path";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "new-frankfurter",
  service: "Frankfurter v2",
  fixture: resolve(import.meta.dirname, "../../fixtures/specs/frankfurter"),
  request:
    "Build a connector from openapi.json to list available currencies and get the rate for a currency pair. I normally want the latest rate, but sometimes supply a historical date. Keep the date and numeric rate that the service actually returns. These two actions are enough.",
  persona:
    "You build integrations in Prismatic’s low-code designer and do not write code. You want the requested connector, have no architectural preferences, and can supply real service credentials later. Use mocked service calls now and publish only to the authenticated Prismatic sandbox. The supplied service contract is the source of truth for this exercise.",
  operations: [
    "list available currencies",
    "get latest or dated exchange rate for a currency pair",
  ],
  tests: [
    "latest request omits the date parameter",
    "historical request sends the supplied date",
    "response retains the service date and a fractional numeric rate without rounding",
    "currency listing preserves currency codes and names",
  ],
  tags: ["openapi", "no-auth", "optional-query", "numeric-output"],
  contract:
    "Authoritative supplied Frankfurter v2 contract: base https://api.frankfurter.dev/v2, no authentication. GET /currencies returns currency objects containing iso_code and name among other fields. GET /rate/{base}/{quote} accepts optional date query (YYYY-MM-DD) and returns {date:string,base:string,quote:string,rate:number}. GET /rates with documented base/quotes filtering is an acceptable equivalent. Preserve the service date and unrounded numeric rate even if service date differs from requested date; omit the date parameter for latest. A configurable base URL connection without credentials is allowed.",
  criteria: [
    {
      id: "rate-contract",
      criteria:
        "Use the supplied v2 API, without inventing authentication or depending on v1 response shapes. GET /rate/{base}/{quote} with optional date is the direct pair operation; a documented equivalent query to /rates is acceptable if it unambiguously returns the requested pair. Preserve the returned date even when it differs from the requested date and preserve fractional rates as numbers. Do not replace the returned date with the requested date or assume a latest rate is today’s rate.",
    },
  ],
});
