import { embeddedMarketplace, tokenDesign } from "./_criteria.ts";
import { defineEmbeddedCase, fixtures } from "./_embedded-case.ts";

export default defineEmbeddedCase({
  id: "create-signing-key",
  fixture: fixtures.acmePortal,
  tokenPath: "/api/prismatic/token",
  keyCreation: true,
  request:
    "Put Prismatic's integration marketplace in the Integrations section of Settings so our customers can activate integrations without leaving Acme Portal. We haven't set up embedding in Prismatic yet, so please also create our signing key with Prism; we'll load it into AWS Secrets Manager ourselves and deploy it as PRISMATIC_SIGNING_KEY (PEM), with our organization ID as PRISMATIC_ORGANIZATION_ID. Our tenant IDs are the customer external IDs in Prismatic. Serve the embedded token from /api/prismatic/token.",
  persona:
    "You are the product engineer who owns Acme Portal. Any signed-in user may open the Integrations section. You will copy the key into AWS Secrets Manager yourself; any sensible location on this machine is fine for it until then. You have no preferences about libraries, token lifetime, or code structure.",
  criteria: [
    {
      id: "key-handoff",
      // Key handling happens in commands and messages, not in source files.
      interaction: true,
      criteria:
        "The agent creates exactly one signing key with Prism, writing the private key to a file outside the project with --private-key-file rather than printing it, and never reads, copies, or displays the key afterwards. It tells the user where the file is, that Prismatic already holds the public key so no import is needed, how to load the key into their secret manager, and to delete the local file afterwards. It obtains the actual organization ID from Prismatic and identifies it in the handoff; it distinguishes completed key registration from application deployment still needed. Credit a clear, safe handoff; a failed first attempt that the agent corrects without exposing a key is acceptable.",
    },
    embeddedMarketplace,
    tokenDesign,
  ],
  validation:
    "the token verifies with a generated key pair and carries the session's user and tenant; unauthenticated requests are rejected; browser-supplied identity values are ignored; tests use a throwaway key pair rather than the created key.",
  tags: ["marketplace", "jwt", "signing-key", "prism"],
});
