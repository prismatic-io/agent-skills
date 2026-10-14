import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/bespoke-order-sync/input",
  prompt: suite.prompt(
    "We want to retire the host running this order bridge. Replace it with a locally testable Prismatic integration using the attached script and handover. When a run fails, our operators repair the source record and restart it; fulfillment must not lose orders or create extra tasks. Show what happens during a failure and recovery, and tell us what we need before we can switch the job over.",
  ),
  persona:
    "You are the operations owner of the order bridge, not a Prismatic developer. The operating and service contracts are in legacy/OPERATIONS.md and legacy/API.md. If asked about recovery, explain that failed jobs page the operator, the bad source record is repaired, and the job is restarted. Replaying fulfillment updates is acceptable under the documented idempotent PUT contract, but you have not approved changing the checkpoint or retry policy. If asked about cutover, you can arrange for the operator to stop cron and supply the final cursor later; neither that cursor nor live credentials is available now. There is one shop and one fulfillment account. You need any proposed operational changes explained.",
  assertions: [
    {
      type: "rubric",
      id: "observable-effects",
      criteria:
        "The CNI implements authenticated paginated retrieval, paid-only upserts and source-defined payload transformation, preserving zero prices and multi-line orders. Opaque cursor and order IDs are encoded correctly and credentials remain distinct. Empty pages still advance state. No timestamps substituted for continuation tokens or fabricated service SDK methods. Use GET /changes with opaque after cursor and PUT /orders/<encoded ID>. Payload preserves externalId, currency, per-unit integer cents and quantities, and trims/lowercases customer email. Reject nonadvancing cursors.",
    },
    {
      type: "rubric",
      id: "recovery-and-state",
      criteria:
        "Target behavior handles page failure and replay without losing orders, retains the source per-page durable checkpoint semantics, and avoids claiming execution-scoped state commits survive failed executions. It preserves bounded transient retry versus terminal failures, identifies concurrency/cutover state assumptions, and accounts for safe destination replay using the documented idempotent PUT. The source nonoverlap guarantee has an effective target mechanism or activation is explicitly blocked pending one; an unchecked in-memory flag or prose warning does not establish mutual exclusion across executions. Network errors/timeouts and non-429/503 failures are terminal under the source contract. A disclosed behavioral change earns handoff credit, not preservation credit; do not accept a changed checkpoint, concurrency, or retry policy as equivalent without source-supported justification. Three total attempts only for HTTP 429/503, honoring Retry-After seconds or exponential fallback. Commit a page cursor only after all eligible writes succeed; earlier committed pages survive later failure. Prismatic successful-execution state persistence is not automatically equivalent to per-page file commit.",
    },
  ],
});
