import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/github-actions-discord/input",
  prompt: suite.prompt(
    "We want to replace this Discord notification GitHub Action with a Prismatic integration. Teams use its default event notifications as well as custom text and embeds from their workflows. Build, import, and verify a code-native replacement that keeps the messaging and failure behavior, and explain how our workflow owners should hand events and configuration to it. The existing action is attached. Leave deployment and live Discord sending to our operations team.",
  ),
  persona:
    "You own the team's GitHub workflows. The attached action and README describe current usage. You can supply the existing event JSON and workflow metadata to the replacement; operations will arrange the actual caller and credentials later. No production Discord webhook credential is available in this session. Message templates are trusted configuration authored by workflow owners, not arbitrary public input. Preserve existing supported use; you cannot approve silent behavior changes or invent a new delivery policy.",
  assertions: [
    {
      type: "rubric",
      id: "notification-posting",
      criteria:
        "Registered replacement preserves the source's distinct default-event and custom-message modes, endpoint suffix/query, JSON payload meanings, event header and Unicode content. Custom messages use caller-supplied event and trusted workflow template configuration rather than hardcoded sample output. Optional embeds, mentions, username and avatar are carried according to the actual source branch. Equivalent component/client/custom code architectures and caller representations are valid; do not require an HTTP trigger or one target flow per mode. With no positional arguments and no DISCORD_EMBEDS, POST reserialized event JSON to webhook/github?wait=true. Arguments joined by spaces or embeds select custom mode: lodash {{expression}} interpolation over environment plus EVENT_PAYLOAD, then JSON content and optional embeds/allowed_mentions/username/avatar_url to webhook?wait=true. Mentions alone do not select custom mode and are parsed only there. Both modes use JSON Content-Type and X-GitHub-Event.",
    },
    {
      type: "rubric",
      id: "configuration-and-failure",
      criteria:
        "Required event/configuration evidence is validated or supplied through a documented caller boundary; no request occurs for malformed custom embeds/mentions. Branch-sensitive parsing and template expression behavior are preserved or a stakeholder-agreed change is established. HTTP and transport failures are not reported as successful messaging. Source network diagnostic bug need not be copied; do not require exact process exit/log wording from a CNI. Missing live credentials does not justify absent local supported behavior, and invented retries, deduplication or delivery guarantees do not establish preservation. Required metadata is event path/repository/workflow/actor/event name/webhook; GITHUB_ACTION has a fallback. Source parses event JSON, treats 204 as success and 400 or connection refusal as failure; malformed custom embeds fail without sending. Source connection-refusal diagnostics dereference absent err.response.status. Local unchanged-entrypoint execution with locked dependencies establishes these observations, not live Discord or container parity.",
    },
    {
      type: "rubric",
      id: "operational-handoff",
      criteria:
        "Handoff identifies workflow event/metadata/configuration ownership, caller and credential setup, and trusted template boundary without inventing deployed authentication or activation. Local checks do not establish live Discord acceptance, hosted calling or original container-runtime equivalence; assess claims actually made rather than requiring a disclaimer checklist. Draft integration import is verified; customer deployment and live sending are not claimed or performed. A valid replacement need not keep filesystem event transport or Docker packaging.",
    },
  ],
});
