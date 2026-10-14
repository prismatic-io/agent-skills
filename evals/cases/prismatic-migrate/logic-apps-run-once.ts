import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/logic-apps-run-once/input",
  prompt: suite.prompt(
    "We use this Logic Apps run-once job pattern and want a Prismatic port. Concentrate on when the primary action and error action run, including a scheduled time well beyond one normal execution. Make those behaviors locally testable. The HTTP methods and URLs are deployment configuration that we have not filled in yet.",
  ),
  persona:
    "You own the scheduled job pattern. Both HTTP action methods and URLs will be supplied during deployment, not in this session. No credentials are available. Each invocation schedules its own job at its supplied startTime; jobs can be scheduled days ahead. You do not want an unannounced recurring-job replacement or a new best-effort timer service.",
  assertions: [
    {
      type: "rubric",
      id: "deferred-primary-work",
      criteria:
        "The port defers each request's primary work until its supplied time, using a credible durable target mechanism for jobs scheduled beyond one execution. A long setTimeout or in-memory queue is insufficient. It does not run immediately or turn each job into a recurring action. Methods and URLs remain explicit configuration. If separate target flows coordinate through persisted state, confirm the chosen state scope is visible to both and survives JSON serialization between executions; directly passing one flow's private state to another in a test does not establish that boundary. Other sound durable architectures are acceptable. If an indispensable durable facility is unavailable, the locally buildable port must block activation clearly rather than simulate working delayed delivery; a proposed architecture alone does not earn implemented scheduling credit. The source Request schema declares startTime:string but not required; do not invent stronger source validation.",
    },
    {
      type: "rubric",
      id: "dependency-status-routing",
      criteria:
        "The target follows runAfter dependencies: primary work follows successful waiting; error work follows primary failed, skipped, or timed-out outcome, but not primary success. Assess the logical HTTP action's final status where source defaults apply: a first retryable failure or pending 202 Location is not necessarily terminal. A port that treats either as final can misroute the error action. Do not assume the unspecified endpoint actually returns either case or require exact host retry timing. A failure that skips primary still reaches error handling when source dependencies require it. The error operation's own failure cannot recursively retrigger itself. Missing endpoint configuration does not silently become a successful no-op. No exact implementation of Azure Scope classes or target file layout is required. Source HTTP actions have blank methods/URIs and no explicit retryPolicy. Default retries can cover timeout or 408/429/5xx; a supporting stateful workflow without DisableAsyncPattern may poll 202 Location to a terminal response. The export does not establish deployed endpoints or exact host settings. No supplied deduplication key establishes global exactly-once execution.",
    },
  ],
});
