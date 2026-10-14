import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/bespoke-queue-worker/input",
  prompt: suite.prompt(
    "We want to move this customer-change worker off its scheduled host and into Prismatic. The attached worker and API notes are what we run today. A queue incident must not silently lose customer changes or apply them twice. Build the local replacement, demonstrate how it behaves when only part of a batch succeeds, and explain the conditions our operations team must meet before enabling it.",
  ),
  persona:
    "You operate the private queue gateway and CRM; another team will deploy the finished integration. The service and operating contract is in legacy/OPERATIONS.md. If asked about stuck messages, operators repair poison events with separate admin tools; replacing that process with dead-lettering or new retries is not approved. If asked about queue changes, the documented lease and acknowledgement operations are the available interface; you cannot add a renewal API or change lease duration in this session. If asked about accounts, both tokens will be supplied at deployment and are unavailable now. Do not supply guessed load measurements or claim that a deployment will meet the lease deadline: ask the agent to state what operations must verify. You can confirm existing behavior from the notes but cannot approve different loss, replay, or acknowledgement semantics. You do not know Prismatic internals.",
  assertions: [
    {
      type: "rubric",
      id: "message-effects",
      criteria:
        "Registered scheduled flow uses documented methods, separate credentials, encoded customer IDs and receipts, exact email/active values, stable event identity for idempotency and current lease identity for ack. Acknowledgement follows CRM success, never the reverse. No unsupported batch delete or vendor queue SDK assumption. Lease GET /messages?limit=10, sequentially PUT /customers/<encoded ID> with CRM bearer credentials and Idempotency-Key body.eventId, then DELETE /messages/<encoded receipt> with queue credentials. Preserve false active values.",
    },
    {
      type: "rubric",
      id: "partial-failure-and-lease",
      criteria:
        "On CRM or ack failure, stop further message processing and preserve prior externally committed acknowledgements. Redelivery reuses event idempotency key with new receipt. No undisclosed broad retries or swallowed failures. Nonoverlap and 120-second lease assumptions are implemented or activation is explicitly blocked pending enforcement; no fabricated renewal operation. Report monitoring/poison-event/cutover requirements without claiming stronger guarantees. Source has no inline retries, runs once per minute without overlap, and has no lease-renewal API. Queue retention is three days; CRM idempotency lasts seven days and mismatched payloads return 409.",
    },
  ],
});
