import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/logic-apps-queue-settlement/input",
  prompt: suite.prompt(
    "Port this Logic Apps template to Prismatic. Focus on preserving what happens to the Service Bus message when the HTTP work succeeds or fails. Keep the template's example HTTP work for local verification; we will supply the queue connection during deployment.",
  ),
  persona:
    "You own the queue workflow. The supplied Microsoft template is the source; there is no additional private export. Use the example HTTP operation, mocked locally. Real queue credentials are unavailable. Do not add new processing or settlement policies.",
  assertions: [
    {
      type: "rubric",
      id: "status-gated-settlement",
      criteria:
        "The registered target flow receives a locked message using a supported Service Bus mechanism, runs the source HTTP work, and settles that same message by completion on successful processing or dead-letter on failed processing. It does not auto-complete before processing or unconditionally complete in finally. It distinguishes processing failure from completion failure: a rejected completion must not be reclassified as source Scope Failed and cause a new dead-letter decision. Source runAfter statuses remain explicit; timeout/skipped states must not silently be broadened to all failures. Exact Azure internal status labels need not appear in the target. Source HTTP work is GET api.geonames.org/searchJSON?q=seattle&maxRows=10&username=demo. Complete runs only after Scope Succeeded; dead-letter only after Failed; neither declares TimedOut or Skipped. Both use the received LockToken.",
    },
    {
      type: "rubric",
      id: "locked-message-contract",
      criteria:
        "Target APIs and configuration are supported and preserve the received message's settlement identity. Missing queue/namespace/auth inputs are deploy-time requirements, not fabricated connection IDs or executable managed-connector proxy paths. Lock loss or settlement rejection cannot be reported as successful completion. No exactly-once claim is inferred from peek-lock. A different supported polling mechanism is acceptable when its scheduling and lock semantics are explicit. Source polls Main every three minutes in peek-lock mode. Queue and connection selection are unbound template settings. Peek-lock is a received lock, not ordinary message browsing.",
    },
  ],
});
