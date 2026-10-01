import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "bespoke-queue-worker",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-queue-worker/input",
  ),
  request:
    "We want to move this customer-change worker off its scheduled host and into Prismatic. The attached worker and API notes are what we run today. A queue incident must not silently lose customer changes or apply them twice. Build the local replacement, demonstrate how it behaves when only part of a batch succeeds, and explain the conditions our operations team must meet before enabling it.",
  persona:
    "You operate the private queue gateway and CRM; another team will deploy the finished integration. Answer only the question asked, using legacy/OPERATIONS.md as the service and operating contract. If asked about stuck messages, operators repair poison events with separate admin tools; replacing that process with dead-lettering or new retries is not approved. If asked about queue changes, the documented lease and acknowledgement operations are the available interface; you cannot add a renewal API or change lease duration in this session. If asked about accounts, both tokens will be supplied at deployment and are unavailable now. Do not supply guessed load measurements or claim that a deployment will meet the lease deadline: ask the agent to state what operations must verify. You can confirm existing behavior from the notes but cannot approve different loss, replay, or acknowledgement semantics. Prefer an explained recommendation over questions about target libraries. You do not know Prismatic internals.",
  sourceContract:
    "worker.mjs leases GET /messages?limit=10 using queue bearer credential, sequentially PUTs /customers/<encoded ID> with CRM bearer credential and Idempotency-Key body.eventId, body email/active including false, then DELETEs /messages/<encoded receipt>. Receipt changes on replay, eventId remains stable. It stops at first non-2xx/network error, with previous successful acks retained externally. CRM success/ack failure replay must use same idempotency key and new receipt. No inline retry. Queue lease120s, retention3d; CRM idempotency7d, mismatched payload409. Nonoverlap scheduler every minute; no renewal API provided. Independent external ack progress does not depend on Prismatic persisted state.",
  criteria: [
    {
      id: "message-effects",
      criteria:
        "Registered scheduled flow uses documented methods, separate credentials, encoded customer IDs and receipts, exact email/active values, stable event identity for idempotency and current lease identity for ack. Acknowledgement follows CRM success, never the reverse. No unsupported batch delete or vendor queue SDK assumption.",
    },
    {
      id: "partial-failure-and-lease",
      criteria:
        "On CRM or ack failure, stop further message processing and preserve prior externally committed acknowledgements. Redelivery reuses event idempotency key with new receipt. No undisclosed broad retries or swallowed failures. Nonoverlap and 120-second lease assumptions are implemented or activation is explicitly blocked pending enforcement; no fabricated renewal operation. Report monitoring/poison-event/cutover requirements without claiming stronger guarantees.",
    },
  ],
  tests:
    "Exercise actual generated flow with a multi-message lease, inactive customer, second-message CRM failure, and CRM success followed by ack failure. Reinvoke with a new receipt for the same event; assert ordering, earlier ack retention, stable idempotency key and current receipt, and no writes for later messages after failure. Include queue lease failure; do not model externally committed acks as Prismatic state rolled back on failure.",
  tags: ["bespoke", "queue", "partial-ack", "idempotency"],
});
