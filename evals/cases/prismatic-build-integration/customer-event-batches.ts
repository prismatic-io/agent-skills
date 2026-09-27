import { resolve } from "node:path";
import { defineIntegrationCase } from "../../integration-case.ts";

export default defineIntegrationCase({
  id: "customer-event-batches",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/integrations/customer-event-batches",
  ),
  request:
    "Build a customer-configured Code Native Integration that moves event records from our account feed to our customers' delivery API. The feed is paginated and interleaves records for different customer IDs. The destination accepts groups of events for one customer at a time, with a small maximum group size. Keep each customer's events in source order, while letting different customers progress independently where safe. There can be a long backlog; processing must continue across checks without losing records. If a group is rejected, a later check must retry it without silently skipping it. API.md describes both services. There are no live credentials or services; use local mocks only.",
  persona:
    "You manage event delivery for customer accounts. Customers provide feed and delivery credentials, their account ID, and a check cadence. Every source event must reach the destination for its customer ID with its original event ID, sequence, kind and payload. Preserve per-customer order even when the feed interleaves customers. The destination accepts at most three events in one group, all for one customer; multiple groups for that customer must stay ordered. Repeating a confirmed group through the documented idempotency contract is acceptable. Choose the CNI design; no particular batching helper, queue or concurrency level is required.",
  criteria: [
    {
      id: "grouped-ordered-delivery",
      criteria:
        "A locally buildable CNI exposes customer-owned feed/destination credentials, account ID and check cadence. It consumes all documented source pages over bounded continued work, groups destination requests by customer ID with at most the service's group limit, and preserves source order within and across groups for each customer. It sends the documented event fields and bearer-authenticated requests. It may process different customers serially or concurrently if each customer's order remains correct; no particular SDK batch primitive or queue is required.",
    },
    {
      id: "delivery-progress-and-recovery",
      criteria:
        "The implementation respects opaque source continuation and keeps enough progress to resume a long backlog. An unaccepted destination group is not skipped on failure; repeating a previously accepted group with a stable key and identical body is valid. A later page or check must not deliver a later event for one customer before its earlier unconfirmed group. Credit supported platform-owned state and retry guarantees; do not impose one checkpoint granularity, concurrency setting or exactly-once transport mechanism.",
    },
  ],
  validation:
    "representative interleaved customers, more events than one destination group, source continuation, stable idempotent replay after a rejected group and ordering across later work, using contract-faithful mocks and the actual registered request boundary rather than a fixed test count",
  tags: ["transfer", "cni", "grouped-delivery", "ordering", "recovery"],
});
