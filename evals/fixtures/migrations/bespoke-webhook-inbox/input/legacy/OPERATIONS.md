# Signed partner event receiver

Run Node 22 `server.mjs` with WEBHOOK_SECRET, INBOX_DIR (persistent local disk)
and optionally PORT. The service accepts POST /events. The partner signs the
exact bytes `timestamp + "." + deliveryId + "." + rawRequestBody` using HMAC-SHA256.
Headers are x-event-time (Unix seconds), x-delivery-id and x-event-signature
(lowercase hexadecimal). Both sides use synchronized clocks; timestamps more
than five minutes in either direction from the receiver clock are rejected. The partner creates a fresh
timestamp/signature when retrying an existing delivery ID. JSON whitespace is
significant to the signature. Event id and type are required strings.

A 202 means the inbox file write completed, not that downstream processing did.
On 503 the partner retries; 400/401 are investigated. Repeated delivery IDs are
accepted without a second file, even when their retry timestamp changes.
An internal reconciler reads the inbox and applies events; that separate process
is not part of this replacement. Preserve the stored {delivery,event} contract
and give the reconciler a documented way to read accepted events after cutover.

The old service runs as one replica. Inbox files are retained for 30 days by a
nightly maintenance job; after deletion, an old delivery ID could be accepted
again. The filesystem write and crash recovery are not transactional: operators
quarantine and recover truncated files after an interrupted write. Do not claim
exactly-once processing or uninterrupted power-loss durability from this code.
For Prismatic, choose an appropriate durable inbox; no destination account or
credentials have been supplied. Provide local storage mocks and clearly identify
deployment configuration needed. Do not replace acknowledgement of durable
acceptance with acknowledgement before the inbox write succeeds.
