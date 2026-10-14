import { subjectPath } from "@prismatic-io/lux";
import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: `Use the coordinating skill at ${subjectPath("orby/SKILL.md")}.

I have already signed up and can access my Prismatic organization.
Help me set up the existing organization.
- Check the available roles and explain how I would give two colleagues administrator access. Do not invite anyone yet.
- Add an Acme component that can listen to our webhooks.
- Use an available Slack component, or add one if needed, to send messages.
- Build an integration that receives the Acme webhooks and sends a message to Slack.

Publish the new components and import a new copy of the integration for us to review. Check that they are available without changing our other components or integrations. Test with mocked external services; do not deploy customer instances or send live Slack messages. Tell me which setup remains.`,
  persona:
    "You have already created your Prismatic account and organization. You want to understand administrator roles, then review an Acme webhook connector and an integration that sends its events to Slack. You will handle actual invitations and provide external-service credentials later. You have no Acme API documentation or live service access to supply here and no preference about implementation libraries. Answer questions within these facts; do not invent Acme service endpoints or authorize customer deployment, live messages, or changes to existing resources.",
  assertions: [
    {
      id: "routes-each-specialized-stage",
      type: "rubric",
      threshold: 0.9,
      criteria: `Orby decomposes the request and uses the canonical installed
prismatic-components skill for the Acme webhook connector and the canonical installed
prismatic-integrations skill for the Acme-to-Slack integration. Assess actual application of the appropriate specialist guidance, whether the agent invokes the skill or reads its canonical file; do not require a particular discovery sequence or invocation mechanism. The result contains usable component and integration artifacts; a monorepo or separate projects are both valid; merely recommending the skills or writing a plan is insufficient.`,
    },
    {
      id: "useful-local-artifacts",
      type: "rubric",
      criteria: `The local artifacts make credible progress toward the request: the Acme
component exposes an inbound webhook trigger, and the integration consumes the Acme event and
uses Prismatic's existing Slack component or otherwise clearly models a Slack message action.
Grade orchestration and the handoff between the component and integration, not production completeness or one
specific Spectral API shape.`,
    },
    {
      id: "honest-platform-handoff",
      type: "rubric",
      criteria: `Actual Prism invocation results establish publication of the fresh Acme component and any additionally authored components and import and availability of the integration in the target Prismatic organization. The agent verifies organization roles without sending invitations or modifying unrelated resources. The final answer accurately distinguishes published artifacts from customer deployment and live-service verification still needed. Final claims alone are insufficient.`,
    },
  ],
});
