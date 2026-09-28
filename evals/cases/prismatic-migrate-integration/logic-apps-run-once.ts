import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "logic-apps-run-once",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/logic-apps-run-once/input",
  ),
  request:
    "We use this Logic Apps run-once job pattern and want a Prismatic port. Concentrate on when the primary action and error action run, including a scheduled time well beyond one normal execution. Make those behaviors locally testable. The HTTP methods and URLs are deployment configuration that we have not filled in yet.",
  persona:
    "You own the scheduled job pattern. Both HTTP action methods and URLs will be supplied during deployment, not in this session. No credentials are available. Each invocation schedules its own job at its supplied startTime; jobs can be scheduled days ahead. You do not want an unannounced recurring-job replacement or a new best-effort timer service.",
  sourceContract:
    "The unchanged Microsoft scheduler-run-once-http template is a Request trigger with startTime string. Delay_until Wait uses that timestamp. Primary_actions Scope runs after Delay_until Succeeded; its Call_HTTP has blank method and URI. Error_actions Scope runs after Primary_actions Failed, Skipped, or TimedOut; its Call_HTTP_on_Error also has blank method and URI. Therefore Delay_until failure can skip primary and enable the error branch. JSON lists Error_actions before Primary_actions but runAfter determines execution. The request schema does not mark startTime required; do not pretend source schema proves validation behavior beyond this. Deferred jobs use a workflow Wait, not a Node process timer. With no explicit HTTP retryPolicy, the operation's default policy can retry a transient timeout or 408/429/5xx response before the action reaches its final status. In a supporting stateful workflow without DisableAsyncPattern, a 202 response with Location can remain pending until polling reaches a terminal response. runAfter depends on the final logical action status, not the first wire response; the export does not specify deployed endpoint behavior or exact host settings. Relevant status semantics: https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling and https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-workflow-actions-triggers#run-actions-in-a-synchronous-operation-pattern . No source deduplication key or global exactly-once guarantee is supplied.",
  criteria: [
    {
      id: "deferred-primary-work",
      criteria:
        "The port defers each request's primary work until its supplied time, using a credible durable target mechanism for jobs scheduled beyond one execution. A long setTimeout or in-memory queue is insufficient. It does not run immediately or turn each job into a recurring action. Methods and URLs remain explicit configuration. If separate target flows coordinate through persisted state, confirm the chosen state scope is visible to both and survives JSON serialization between executions; directly passing one flow's private state to another in a test does not establish that boundary. Other sound durable architectures are acceptable. If an indispensable durable facility is unavailable, the locally buildable port must block activation clearly rather than simulate working delayed delivery; a proposed architecture alone does not earn implemented scheduling credit.",
    },
    {
      id: "dependency-status-routing",
      criteria:
        "The target follows runAfter dependencies: primary work follows successful waiting; error work follows primary failed, skipped, or timed-out outcome, but not primary success. Assess the logical HTTP action's final status where source defaults apply: a first retryable failure or pending 202 Location is not necessarily terminal. A port that treats either as final can misroute the error action. Do not assume the unspecified endpoint actually returns either case or require exact host retry timing. A failure that skips primary still reaches error handling when source dependencies require it. The error operation's own failure cannot recursively retrigger itself. Missing endpoint configuration does not silently become a successful no-op. No exact implementation of Azure Scope classes or target file layout is required.",
    },
  ],
  tests:
    "Use controlled time or a mocked durable scheduling boundary to show primary work does not happen before the requested time and resumes with the needed request/configuration context. For a state-based multi-flow design, rehydrate committed state through a JSON round trip before a separate worker invocation and use the target's actual shared scope. Exercise primary success, terminal failure after any supported retries, timeout, and a wait failure that skips primary; assert whether the error operation is invoked and that its own failure is surfaced. Where an HTTP test seam permits it, distinguish a pending 202 Location from final action success. Tests must exercise the target orchestration, not merely reconstruct an expected runAfter table disconnected from execution.",
  tags: ["logic-apps", "durable-wait", "run-after", "focused"],
});
