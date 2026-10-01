import { resolve } from "node:path";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "new-partner-catalog",
  service: "the fictional Partner Catalog API",
  fixture: resolve(import.meta.dirname, "../../fixtures/specs/partner-catalog"),
  request:
    "Build a connector using service.md so I can list products and get one product by ID. Each customer gives us application credentials, and nobody signs into a browser. I want to configure those credentials once on the connection and keep using the actions after access tokens expire. We do not have real credentials available yet.",
  persona:
    "You build integrations in Prismatic’s low-code designer and do not write code. You want the requested connector, have no architectural preferences, and can supply real service credentials later. Use mocked service calls now and publish only to our Prismatic organization. The supplied documentation describes the API you use.",
  operations: ["list products", "get product by opaque ID"],
  tests: [
    "resource calls use the configured access token as a Bearer token",
    "get safely encodes an opaque ID containing reserved characters",
    "if the component implements token acquisition itself, test its form body, Basic authentication, and obtaining a new token after expiry. For platform-managed acquisition, the Bearer resource-call tests suffice here; connection declaration correctness is graded separately by client-credentials, so do not require unit tests of static metadata or platform internals",
  ],
  tags: ["oauth-client-credentials", "connection", "path-encoding"],
  contract:
    'Authoritative authored Partner Catalog v1 contract: base https://catalog.partner.invalid/v1. POST https://catalog.partner.invalid/oauth/token uses HTTP Basic client ID/secret and form fields grant_type=client_credentials and scope=catalog.read. Success {access_token,token_type:"Bearer",expires_in:3600}; no browser authorization URL or refresh token. Renew by acquiring another token after expiry. Resource Authorization is Bearer. GET /products returns {products:[{id,name,price}]}; GET /products/{id} returns {id,name,price}; opaque IDs need path-segment encoding. No pagination. 401 invalid_client/invalid_token and 404 not_found are errors. Platform-managed token acquisition is acceptable and does not need mocked platform internals; secrets must not appear in logs or outputs.',
  criteria: [
    {
      id: "client-credentials",
      criteria:
        "The registered connection supports the documented client-credentials flow with catalog.read scope and the token URL in service.md, requires no authorization URL or interactive sign-in, and has a path to obtaining a new token after expiry. The token endpoint authenticates via HTTP Basic and a form body; credential/token leakage in logs or returned action data fails. Prismatic-managed token acquisition/renewal is valid: do not require reimplementing or unit-testing platform internals, but inspect the actual connection declaration and resource authorization code. A permanent manually pasted access token is insufficient.",
    },
  ],
});
