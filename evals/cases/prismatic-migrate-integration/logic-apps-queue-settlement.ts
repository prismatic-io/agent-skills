import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "logic-apps-queue-settlement",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/logic-apps-queue-settlement/input",
  ),
  request:
    "Port this Logic Apps template to Prismatic. Focus on preserving what happens to the Service Bus message when the HTTP work succeeds or fails. Keep the template's example HTTP work for local verification; we will supply the queue connection during deployment.",
  persona:
    "You own the queue workflow. The supplied Microsoft template is the source; there is no additional private export. Use the example HTTP operation, mocked locally. Real queue credentials are unavailable. You have no preference about libraries or Prismatic architecture. Do not add new processing or settlement policies.",
  sourceContract:
    "The unchanged Microsoft Logic Apps service-bus-peek-lock-dead-letter template polls a Service Bus Main queue every 3 minutes in peek-lock mode. Scope contains an HTTP GET to api.geonames.org/searchJSON?q=seattle&maxRows=10&username=demo. Complete_the_message_in_a_queue runs only after Scope Succeeded, with triggerBody LockToken. Dead-letter_the_message_in_a_queue runs only after Scope Failed, with the same received lock token. Neither branch declares Scope TimedOut or Skipped. Actions object order is not control flow; runAfter is. Managed connector //messages/... paths are not portable Service Bus REST endpoints; connection reference and queue selection are unbound template settings. Microsoft runAfter docs: https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling . Peek-lock requires settlement of the received locked message, not ordinary browsing: https://learn.microsoft.com/en-us/rest/api/servicebus/peek-lock-message-non-destructive-read . Expired/rejected settlement is not proof the message was removed.",
  criteria: [
    {
      id: "status-gated-settlement",
      criteria:
        "The registered target flow receives a locked message using a supported Service Bus mechanism, runs the source HTTP work, and settles that same message by completion on successful processing or dead-letter on failed processing. It does not auto-complete before processing or unconditionally complete in finally. It distinguishes processing failure from completion failure: a rejected completion must not be reclassified as source Scope Failed and cause a new dead-letter decision. Source runAfter statuses remain explicit; timeout/skipped states must not silently be broadened to all failures. Exact Azure internal status labels need not appear in the target.",
    },
    {
      id: "locked-message-contract",
      criteria:
        "Target APIs and configuration are supported and preserve the received message's settlement identity. Missing queue/namespace/auth inputs are deploy-time requirements, not fabricated connection IDs or executable managed-connector proxy paths. Lock loss or settlement rejection cannot be reported as successful completion. No exactly-once claim is inferred from peek-lock. A different supported polling mechanism is acceptable when its scheduling and lock semantics are explicit.",
    },
  ],
  tests:
    "Exercise the generated orchestration with HTTP success and processing failure, asserting mutually exclusive complete/dead-letter effects for the received message. Include completion rejected due to lost/expired lock and verify it does not execute the source failure branch merely because completion failed. Verify known timeout/skipped status behavior if the target represents those states; otherwise substantiate the documented mapping rather than invent an unrelated queue policy.",
  tags: ["logic-apps", "queue-settlement", "run-after", "focused"],
});
