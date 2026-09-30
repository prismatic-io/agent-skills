import { embeddedMarketplace, tokenDesign } from "./_criteria.ts";
import { defineEmbeddedCase, fixtures } from "./_embedded-case.ts";

export default defineEmbeddedCase({
  id: "marketplace-settings",
  fixture: fixtures.acmePortal,
  tokenPath: "/api/prismatic/token",
  request:
    "Our customers keep asking to connect Acme Portal to the other tools they use. We've built integrations in Prismatic and want customers to find and activate them in the Integrations section of Settings, without leaving our app. The platform team will provide our Prismatic signing key (PEM) as PRISMATIC_SIGNING_KEY and our organization ID as PRISMATIC_ORGANIZATION_ID. Our tenant IDs are the customer external IDs in Prismatic. Serve the embedded token from /api/prismatic/token.",
  persona:
    "You are the product engineer who owns Acme Portal. Any signed-in user may open the Integrations section; role restrictions can come later. Your Prismatic organization is on https://app.prismatic.io. You want the marketplace inline in the Settings page, not a popover, but you have no preferences about libraries, token lifetime, or code structure. You have not registered a signing key yet and cannot share one; there are no Prismatic credentials in this session.",
  criteria: [embeddedMarketplace, tokenDesign],
  validation:
    "the token verifies with the public half of a generated key pair and carries the session's user and tenant; unauthenticated requests are rejected; query, body, or header identity values are ignored; missing configuration fails clearly; a mocked SDK sees init before authenticate before showMarketplace and a refresh before expiry; a failed authentication shows an error.",
  tags: ["marketplace", "jwt", "react", "express"],
});
