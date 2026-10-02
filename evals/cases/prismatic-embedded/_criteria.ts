export const embeddedMarketplace = {
  id: "embedded-marketplace",
  criteria:
    "The Integrations section of Settings renders Prismatic's marketplace with @prismatic-io/embedded for signed-in users. Browser code initializes the SDK once per page load, fetches a token from the app's backend with the existing session, authenticates before showing the marketplace, uses the presentation requested by the stakeholder, with a mounted container of usable height for inline embedding, re-authenticates before the token expires without re-rendering the iframe, cleans up timers on unmount, and shows a visible state when the token fetch or authentication fails. Existing Settings content and navigation remain. Do not require a particular component structure, hook, or refresh timing.",
};

export const tokenDesign = {
  id: "token-design",
  criteria:
    "The backend token endpoint follows Prismatic's embedded contract: RS256 with sub as the signed-in user's stable ID, customer as the tenant ID, organization and the private key from server-side configuration (PRISMATIC_ORGANIZATION_ID and PRISMATIC_SIGNING_KEY), iat as the issuance time (a small clock-skew buffer is optional), a short exp, and the expiry returned to the browser. Identity comes only from the authenticated session, never from browser-supplied values, and the existing auth middleware protects it. Optional claims such as external_id, name, and customer_name are fine; role should not be set without user-level configuration. Missing configuration fails clearly without leaking the key. Private-key signing stays on the backend; browser code obtains tokens from that endpoint without receiving the signing key. Assess executable behavior and exposed values, not library names or explanatory comments; decoding a token in the browser does not constitute signing.",
};
