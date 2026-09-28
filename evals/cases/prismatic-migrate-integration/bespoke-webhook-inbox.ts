import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";

export default defineMigrationCase({
  id: "bespoke-webhook-inbox",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-webhook-inbox/input",
  ),
  request:
    "Replace this small partner webhook receiver with Prismatic. Preserve what the sender and our reconciler depend on. Build and verify the port locally, and document the storage and cutover work we still need.",
  persona:
    "You operate the receiving service. The source and handover describe its contract. No live partner secret or storage credentials are available. The reconciler must continue to read accepted events, but the target storage product is not prescribed.",
  sourceContract:
    "server.mjs signs timestamp.deliveryId.rawBytes with HMAC-SHA256, checks lowercase hex and a ±300 second window, and only then parses JSON requiring string event id/type. It accepts POST /events, rejects >1MiB payloads, returns 401 authentication failure, 400 invalid event, 202 after inbox write, 503 on storage failure. Files keyed by hash of delivery ID use exclusive creation: authenticated retry of same delivery returns 202 without overwriting. Sender retries with a new timestamp but stable delivery ID. Stored record is {delivery,event}. 30-day retention bounds deduplication; original write has a disclosed interrupted-write recovery limitation, not exactly-once processing. Reconciler is out of scope but storage handoff must remain usable.",
  criteria: [
    {
      id: "authenticated-raw-input",
      criteria:
        "The registered endpoint verifies exact raw bytes and signed timestamp/delivery identity before accepting, preserves rejection and response semantics, rejects stale/future or malformed signatures, and does not verify JSON reserialization. Authentication secrets are deployment configuration. Respect the one-MiB acceptance bound or explicitly block activation pending equivalent enforcement.",
    },
    {
      id: "durable-acceptance",
      criteria:
        "A 202 follows successful durable inbox acceptance; a failed write yields retryable failure. Duplicate delivery does not overwrite or duplicate the inbox record. As the source distinguishes EEXIST from other write errors, the target must distinguish a documented already-present result from contention or service failures; a generic conflict status alone does not prove durable acceptance. The chosen storage contract supports the required conditional write through a documented provider or an implemented gateway; a desired self-authored HTTP contract without either does not earn implemented-durability credit. Process memory or ordinary Prismatic state alone cannot prove cross-execution atomic deduplication. Missing real storage configuration is explicit and fails closed. Explain reconciler access, retention and limitations without claiming exactly-once processing.",
    },
  ],
  tests:
    "Exercise the registered handler with exact signed raw JSON, the same semantic JSON using altered whitespace, timestamps outside the five-minute past/future window, malformed signature, authenticated malformed JSON, repeat delivery with fresh timestamp, and inbox failure. Assert response timing/ack after storage and observed inbox effects. Distinguish the chosen store's documented already-present outcome from contention and other failed writes that do not establish an existing record; assert those failures cannot produce an acceptance response. Mock a documented provider contract or exercise an implemented gateway, not merely the contract an unimplemented service would need to satisfy. Do not invent successful durability via a detached Map helper.",
  tags: ["bespoke", "webhook", "raw-bytes", "durable-inbox"],
});
