import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/bespoke-webhook-inbox/input",
  prompt: suite.prompt(
    "Replace this small partner webhook receiver with Prismatic. Preserve what the sender and our reconciler depend on. Build and verify the port locally, and document the storage and cutover work we still need.",
  ),
  persona:
    "You operate the receiving service. The source and handover describe its contract. No live partner secret or storage credentials are available. The reconciler must continue to read accepted events, but the target storage product is not prescribed.",
  assertions: [
    {
      type: "rubric",
      id: "authenticated-raw-input",
      criteria:
        "The registered endpoint verifies exact raw bytes and signed timestamp/delivery identity before accepting, preserves rejection and response semantics, rejects stale/future or malformed signatures, and does not verify JSON reserialization. Authentication secrets are deployment configuration. Respect the one-MiB acceptance bound or explicitly block activation pending equivalent enforcement. POST /events verifies lowercase-hex HMAC-SHA256 of timestamp.deliveryId.rawBytes within ±300 seconds, then parses JSON requiring string event id/type. Authentication failure is 401, invalid event 400.",
    },
    {
      type: "rubric",
      id: "durable-acceptance",
      criteria:
        "A 202 follows successful durable inbox acceptance; a failed write yields retryable failure. Duplicate delivery does not overwrite or duplicate the inbox record. As the source distinguishes EEXIST from other write errors, the target must distinguish a documented already-present result from contention or service failures; a generic conflict status alone does not prove durable acceptance. The chosen storage contract supports the required conditional write through a documented provider or an implemented gateway; a desired self-authored HTTP contract without either does not earn implemented-durability credit. Process memory or ordinary Prismatic state alone cannot prove cross-execution atomic deduplication. Missing real storage configuration is explicit and fails closed. Explain reconciler access, retention and limitations without claiming exactly-once processing. Store {delivery,event}; source uses exclusive creation keyed by hashed delivery ID. Sender retries use a fresh timestamp and stable delivery ID; storage failure is 503. Deduplication is bounded by 30-day retention and source interrupted-write recovery is already limited. Reconciler implementation is out of scope.",
    },
  ],
});
