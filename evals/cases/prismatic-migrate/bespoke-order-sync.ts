import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "bespoke-order-sync",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-order-sync/input",
  ),
  request:
    "We want to retire the host running this order bridge. Replace it with a locally testable Prismatic integration using the attached script and handover. When a run fails, our operators repair the source record and restart it; fulfillment must not lose orders or create extra tasks. Show what happens during a failure and recovery, and tell us what we need before we can switch the job over.",
  persona:
    "You are the operations owner of the order bridge, not a Prismatic developer. Answer the question asked in ordinary business language using legacy/OPERATIONS.md and legacy/API.md. If asked about recovery, explain that failed jobs page the operator, the bad source record is repaired, and the job is restarted. Replaying fulfillment updates is acceptable under the documented idempotent PUT contract, but you have not approved changing the checkpoint or retry policy. If asked about cutover, you can arrange for the operator to stop cron and supply the final cursor later; neither that cursor nor live credentials is available now. There is one shop and one fulfillment account. For target architecture, ask the agent to recommend an approach and explain operational changes instead of choosing libraries for them. Do not invent endpoints, extra gateway capabilities, production measurements, or consent to behavior changes. If the supplied material cannot answer a question, say what is unavailable and let the agent continue the supported local work.",
  sourceContract:
    "order-sync.mjs and API.md specify separate bearer credentials, GET /changes with URL-encoded opaque after cursor, all pages including empty pages with advancing cursors, and paid-only upserts to PUT /orders/<encoded ID>. Payload preserves externalId, currency, per-unit integer cents and quantities, and trims/lowercases customer email. PUT is idempotent by ID. Three total attempts only on HTTP 429/503 with Retry-After seconds or exponential fallback; other statuses, network errors and timeouts fail. File cursor is atomically advanced only after every eligible order in that page succeeds. Earlier successful pages survive a later page failure. Failed page can replay prior upserts safely. A nonadvancing cursor fails. Operations notes use a nonoverlapping cron job. Prismatic successful-execution state persistence is not automatically equivalent to per-page file commit.",
  criteria: [
    {
      id: "observable-effects",
      criteria:
        "The CNI implements authenticated paginated retrieval, paid-only upserts and source-defined payload transformation, preserving zero prices and multi-line orders. Opaque cursor and order IDs are encoded correctly and credentials remain distinct. Empty pages still advance state. No timestamps substituted for continuation tokens or fabricated service SDK methods.",
    },
    {
      id: "recovery-and-state",
      criteria:
        "Target behavior handles page failure and replay without losing orders, retains the source per-page durable checkpoint semantics, and avoids claiming execution-scoped state commits survive failed executions. It preserves bounded transient retry versus terminal failures, identifies concurrency/cutover state assumptions, and accounts for safe destination replay using the documented idempotent PUT. The source nonoverlap guarantee has an effective target mechanism or activation is explicitly blocked pending one; an unchecked in-memory flag or prose warning does not establish mutual exclusion across executions. Network errors/timeouts and non-429/503 failures are terminal under the source contract. A disclosed behavioral change earns handoff credit, not preservation credit; do not accept a changed checkpoint, concurrency, or retry policy as equivalent without source-supported justification.",
    },
  ],
  tests:
    "Exercise the generated path with mixed paid/cancelled orders, multi-line values including zero, encoded identifiers/cursors, more than one page and an empty page. Include transient retry, terminal destination failure partway through a page, and resume/replay after failure with expected writes and cursor effects. Recovery tests reload state using actual target persistence semantics after a failed invocation, rather than reusing a mutated in-memory context that the platform would discard. Check actual effects against source behavior; tests of isolated duplicate implementation or constants do not establish a working migration.",
  tags: ["bespoke", "stateful", "recovery"],
});
