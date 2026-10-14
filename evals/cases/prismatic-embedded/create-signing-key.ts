import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Put Prismatic's integration marketplace in the Integrations section of Settings so our customers can activate integrations without leaving Acme Portal. We haven't set up embedding in Prismatic yet, so please also create our signing key with Prism; we'll load it into AWS Secrets Manager ourselves and deploy it as PRISMATIC_SIGNING_KEY (PEM), with our organization ID as PRISMATIC_ORGANIZATION_ID. Our tenant IDs are the customer external IDs in Prismatic. Serve the embedded token from /api/prismatic/token.",
  ),
  persona:
    "Any signed-in user may open the Integrations section. Any sensible location outside the project is fine for the key until you copy it into AWS Secrets Manager.",
  assertions: [
    {
      id: "key-handoff",
      type: "rubric",
      criteria:
        "The agent creates exactly one signing key with Prism, writing the private key to a file outside the project with --private-key-file rather than printing it, and never reads, copies, or displays the key afterwards. It tells the user where the file is, that Prismatic already holds the public key so no import is needed, how to load the key into their secret manager, and to delete the local file afterwards. It obtains the actual organization ID from Prismatic and identifies it in the handoff; it distinguishes completed key registration from application deployment still needed. Credit a clear, safe handoff; a failed first attempt that the agent corrects without exposing a key is acceptable.",
      evidence: { view: "execution" },
    },
  ],
});
