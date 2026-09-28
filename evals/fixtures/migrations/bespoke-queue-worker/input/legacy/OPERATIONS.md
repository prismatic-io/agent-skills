# Customer change queue worker

Run `node worker.mjs` (Node 22) with QUEUE_URL, QUEUE_TOKEN, CRM_URL and CRM_TOKEN.
A scheduler starts one worker every minute; runs must not overlap. This is a
private queue gateway and CRM API, not an AWS or other vendor export format.

GET /messages?limit=10 leases up to ten messages for 120 seconds. JSON is shaped
like leased-messages.json. Receipt handles are opaque and change on re-delivery;
body.eventId is stable. DELETE /messages/<encoded receipt> acknowledges only that
lease. Unacknowledged messages become available after the lease expires. Expired
receipt acknowledgement fails with 409. Queue credentials use bearer auth.

The CRM accepts PUT /customers/<encoded customer ID> with JSON email and active.
Its separate bearer token is required. Idempotency-Key is the stable eventId, not
the receipt or customer ID. The CRM stores the outcome per key for seven days;
an identical retry within that window returns the original success without
applying the change twice. Reusing a key with a different payload fails with 409.
Each successful request returns 204. Inactive customers must remain active:false,
not be omitted. The queue retains messages for three days.

Acknowledge each message only after its CRM request succeeds. If any operation
fails, the worker stops immediately; earlier acknowledgements stay committed,
and the failing plus remaining leased messages reappear after expiry. In
particular, a CRM success followed by ack failure must retry with the same event
key and a NEW receipt on redelivery. No local file or Prismatic state is needed
to remember acknowledgements. No inline retries or dead-letter logic exists;
operators repair poison events through the queue gateway's separate admin tools.

The existing worker assumes a batch finishes within its lease and has no lease
renewal path. Account for this deployment limit; do not invent renewal endpoints
or claim arbitrary-volume reliability. Destination and queue credentials are
unavailable here. Local mocks should establish request and failure behavior.
