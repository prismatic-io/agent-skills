import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Build a connector using service.md so I can list products and get one product by ID. Each customer gives us application credentials, and nobody signs into a browser. I want to configure those credentials once on the connection and keep using the actions after access tokens expire. We do not have real credentials available yet.",
  ),
  fixtures: "../../fixtures/specs/partner-catalog",
  assertions: [
    {
      type: "rubric",
      id: "client-credentials",
      criteria:
        'The requested actions are implemented and registered as usable Spectral actions. The registered connection supports the documented client-credentials flow with catalog.read scope and the token URL in service.md, requires no authorization URL or interactive sign-in, and has a path to obtaining a new token after expiry. The token endpoint authenticates via HTTP Basic and a form body; credential/token leakage in logs or returned action data fails. Prismatic-managed token acquisition/renewal is valid: do not require reimplementing or unit-testing platform internals, but inspect the actual connection declaration and resource authorization code. A permanent manually pasted access token is insufficient. The supplied token URL is https://catalog.partner.invalid/oauth/token; form fields are grant_type=client_credentials and scope=catalog.read. Success returns {access_token,token_type:"Bearer",expires_in:3600}, without a refresh token. Resource base is https://catalog.partner.invalid/v1: GET /products returns {products:[{id,name,price}]} and GET /products/{id} returns {id,name,price}. Opaque IDs need path-segment encoding; there is no pagination. 401 invalid_client/invalid_token and 404 not_found are errors.',
    },
  ],
});
