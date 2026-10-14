import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/github-actions-slack/input",
  prompt: suite.prompt(
    "I want to replace the incoming-webhook path of the attached Slack GitHub Action with a callable Prismatic integration. Use the original source and incoming-webhook examples to preserve its payload options and default/configured send and error behavior. Explain how a workflow caller supplies its inputs and obtains the completed result. Build and test locally without sending to Slack. Slack Web API methods, Workflow Builder webhook triggers and Slack CLI techniques are outside this migration.",
  ),
  persona:
    "You are a workflow owner asking to replace this public action. Webhook credentials will be supplied later, and no live sends are authorized. Equivalent documented caller schemas are fine: saved files may be supplied as contents with a format, and GitHub/environment metadata may be supplied explicitly. You do not require runner filesystem access or a particular connection architecture. Preserve applicable incoming-webhook options and defaults; you have not approved dropping options for convenience. No live accounts are available.",
  assertions: [
    {
      type: "rubric",
      id: "payload-and-metadata",
      criteria:
        "Registered callable integration preserves supplied incoming-webhook payload options: JSON/YAML, equivalent saved-file contents, context fallback, optional recursive templating and delimiter flattening. Preserve values/types/order and invalid-input-before-send behavior. Document metadata/input mapping; do not require host filesystem/environment access. Equivalent caller schema is acceptable.",
    },
    {
      type: "rubric",
      id: "send-policy",
      criteria:
        "Preserve default/configured retries and retryable versus nonretryable failures using pinned source/SDK contracts. For send failures, warning mode exposes an unsuccessful result without failing invocation and failure mode fails. Parsing/configuration errors still fail before sending, independently of that send-error option. Do not silently narrow options or claim unverified proxy/live behavior works. Static policy evidence and observed transport must remain distinguishable; exact SDK error wording or randomized delay equality is not required. Pinned @slack/webhook 8.0.2 observations: default 5, RAPID and 10 each retried a local 503; 0 did not retry and 400 was nonretryable. Static contracts establish configured limits/backoff; full exhaustion/randomized timing were not dynamically measured. Local HTTPS proxy testing failed before CONNECT with fetch failed, so proxy compatibility remains unresolved. errors=false warns; errors=true fails.",
    },
    {
      type: "rubric",
      id: "completed-caller-result",
      criteria:
        "Delivered callable configuration and documentation let caller obtain completed success indicator, response/error and completion time or documented equivalent through synchronous response or usable explicit retrieval contract. Delayed send must not be reported prematurely successful. Registered compiled behavior matters; onExecution return alone does not establish hosted HTTP response. No architecture mandate or invented hosted guarantee. Source sets ok/response/time only after send completion. These are unchanged local Slack GitHub Action 4.0.0 observations, not proof of live Slack or GitHub hosting identity.",
    },
  ],
});
