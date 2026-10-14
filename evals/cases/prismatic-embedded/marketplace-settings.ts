import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Our customers keep asking to connect Acme Portal to the other tools they use. We've built integrations in Prismatic and want customers to find and activate them inline in the Integrations section of Settings, without leaving our app or opening a popover. The platform team will provide our Prismatic signing key (PEM) as PRISMATIC_SIGNING_KEY and our organization ID as PRISMATIC_ORGANIZATION_ID. Our tenant IDs are the customer external IDs in Prismatic. Serve the embedded token from /api/prismatic/token.",
  ),
  persona:
    "Any signed-in user may open the Integrations section; role restrictions can come later. You do not know which signing keys are registered yet.",
});
