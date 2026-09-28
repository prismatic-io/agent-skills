import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";

export default defineMigrationCase({
  id: "github-actions-slack",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/github-actions-slack/input",
  ),
  request:
    "I want to replace the incoming-webhook path of the attached Slack GitHub Action with a callable Prismatic integration. Use the original source and incoming-webhook examples to preserve its payload options and default/configured send and error behavior. Explain how a workflow caller supplies its inputs and obtains the completed result. Build and test locally without sending to Slack. Slack Web API methods, Workflow Builder webhook triggers and Slack CLI techniques are outside this migration.",
  persona:
    "You are a workflow owner asking to replace this public action; do not invent existing customer history. Webhook credentials will be supplied later, and no live sends are authorized. Equivalent documented caller schemas are fine: saved files may be supplied as contents with a format, and GitHub/environment metadata may be supplied explicitly. You do not require runner filesystem access or a particular connection architecture. Preserve applicable incoming-webhook options and defaults; you have not approved dropping options for convenience. Answer actual questions from the attached source and examples without volunteering a hidden test matrix. If caller metadata or routing information is unavailable, state that honestly. No live accounts are available.",
  sourceContract:
    "The supplied Slack GitHub Action4.0.0 source is authoritative for the incoming-webhook path. Actual unchanged entrypoint observations establish JSON/YAML and file payload parsing, optional templating, context fallback, delimiter flattening/stringification, send results and warning/failure modes. Invalid or simultaneous inline/file input aborts before sending. Source uses @slack/webhook8.0.2; actual default5, RAPID and10 each retried a local503 then succeeded;0 does not retry and400 is nonretryable. Static pinned policies establish configured retry limits/backoff, but complete exhaustion/randomized timing were not dynamically measured. Local HTTPS proxy control failed before CONNECT with fetch failed: proxy transport compatibility remains unresolved, not permission to silently discard the option. Results ok/response/time are set after completed send; errors=false warns on send failure, errors=true fails. Parsing/configuration errors precede that send-error wrapper. Actual local source behavior does not prove live Slack or GitHub hosting identity.",
  criteria: [
    {
      id: "payload-and-metadata",
      criteria:
        "Registered callable integration preserves supplied incoming-webhook payload options: JSON/YAML, equivalent saved-file contents, context fallback, optional recursive templating and delimiter flattening. Preserve values/types/order and invalid-input-before-send behavior. Document metadata/input mapping; do not require host filesystem/environment access. Equivalent caller schema is acceptable.",
    },
    {
      id: "send-policy",
      criteria:
        "Preserve default/configured retries and retryable versus nonretryable failures using pinned source/SDK contracts. For send failures, warning mode exposes an unsuccessful result without failing invocation and failure mode fails. Parsing/configuration errors still fail before sending, independently of that send-error option. Do not silently narrow options or claim unverified proxy/live behavior works. Static policy evidence and observed transport must remain distinguishable; exact SDK error wording or randomized delay equality is not required.",
    },
    {
      id: "completed-caller-result",
      criteria:
        "Delivered callable configuration and documentation let caller obtain completed success indicator, response/error and completion time or documented equivalent through synchronous response or usable explicit retrieval contract. Delayed send must not be reported prematurely successful. Registered compiled behavior matters; onExecution return alone does not establish hosted HTTP response. No architecture mandate or invented hosted guarantee.",
    },
  ],
  tests:
    "Meaningfully exercise registered target behavior using source-grounded payload, configuration and service outcomes, including rejection, failed sends and completion. Running the unchanged source against a local HTTP boundary is useful evidence, but no particular comparison helper, generator, framework or fixed test matrix is required. Verify actual implementation and transport rather than only permissive mocks or detached helpers. Distinguish action-only coverage, static retry policy, unresolved proxy compatibility and hosted unknowns. No live Slack sends.",
  tags: ["github-actions", "slack", "webhook", "payload", "retry-policy"],
});
