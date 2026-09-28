import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";

export default defineMigrationCase({
  id: "github-actions-discord",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/github-actions-discord/input",
  ),
  request:
    "We want to replace this Discord notification GitHub Action with a Prismatic integration. Teams use its default event notifications as well as custom text and embeds from their workflows. Build and verify a local code-native replacement that keeps the messaging and failure behavior, and explain how our workflow owners should hand events and configuration to it. The existing action is attached. Leave deployment and live Discord sending to our operations team.",
  persona:
    "You own the team's GitHub workflows. The attached action and README describe current usage. You can supply the existing event JSON and workflow metadata to the replacement; operations will arrange the actual caller and credentials later. No production Discord webhook credential is available in this session. Message templates are trusted configuration authored by workflow owners, not arbitrary public input. Preserve existing supported use; you cannot approve silent behavior changes or invent a new delivery policy. Prefer reasonable implementation recommendations over library-selection questions. Do not volunteer test scenarios or coach the implementation.",
  sourceContract:
    "The unchanged entrypoint was executed locally with its locked dependencies. Required metadata includes event path/repository/workflow/actor/event name/webhook; GITHUB_ACTION gets a fallback. Event JSON is parsed. No positional args and no DISCORD_EMBEDS selects event passthrough: reserialized event JSON POST to webhook/github?wait=true. Positional args joined with spaces or embeds selects custom mode: lodash template interpolation {{expression}} over environment plus EVENT_PAYLOAD, then JSON content and optional embeds/allowed_mentions/username/avatar_url POST to webhook?wait=true. Embeds and mentions parse only in custom mode; mentions alone do not select that mode. Both use JSON Content-Type and X-GitHub-Event. Accepted HTTP204 exits0; HTTP400 exits1. Malformed custom embeds exits1 without a request. Observed Unicode payload/expressions remain intact. Connection refusal exits1 with a source TypeError because catch dereferences absent err.response.status; clean diagnostic wording is not required parity. Templates are trusted executable configuration. No source retries, deduplication, queue or durable state contract is established. No live Discord or original container-runtime proof.",
  criteria: [
    {
      id: "notification-posting",
      criteria:
        "Registered replacement preserves the source's distinct default-event and custom-message modes, endpoint suffix/query, JSON payload meanings, event header and Unicode content. Custom messages use caller-supplied event and trusted workflow template configuration rather than hardcoded sample output. Optional embeds, mentions, username and avatar are carried according to the actual source branch. Equivalent component/client/custom code architectures and caller representations are valid; do not require an HTTP trigger or one target flow per mode.",
    },
    {
      id: "configuration-and-failure",
      criteria:
        "Required event/configuration evidence is validated or supplied through a documented caller boundary; no request occurs for malformed custom embeds/mentions. Branch-sensitive parsing and template expression behavior are preserved or a stakeholder-agreed change is established. HTTP and transport failures are not reported as successful messaging. Source network diagnostic bug need not be copied; do not require exact process exit/log wording from a CNI. Missing live credentials does not justify absent local supported behavior, and invented retries, deduplication or delivery guarantees do not establish preservation.",
    },
    {
      id: "operational-handoff",
      criteria:
        "Handoff identifies workflow event/metadata/configuration ownership, caller and credential setup, and trusted template boundary without inventing deployed authentication or activation. Local checks do not establish live Discord acceptance, hosted calling or original container-runtime equivalence; assess claims actually made rather than requiring a disclaimer checklist. No deployment or live sending is claimed or performed. A valid replacement need not keep filesystem event transport or Docker packaging.",
    },
  ],
  tests:
    "Exercise the registered replacement with source-grounded default and custom usage, configuration rejection and failed service interactions. Verify observable requests/payloads and returned failure behavior independently of implementation assumptions. Running unchanged source locally against isolated HTTP boundaries is valid evidence; source-only checks, builds or detached mapping tests alone do not establish registered target behavior. No particular test helper, file layout, HTTP library or evaluator adapter is required. Local mocked service checks do not prove live Discord or original Docker-runtime equivalence.",
  tags: ["github-actions", "discord", "javascript", "http", "transfer"],
});
