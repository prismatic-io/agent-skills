# Partner order webhook contract

This fictional partner and destination are not live. Build a customer-configured
Code Native Integration and verify it with local mocked requests only. No real
credentials, Prismatic deployment, or external invocation is available.

## Incoming event

The partner sends HTTP POST JSON. `X-Order-Signature` is the lowercase hexadecimal
HMAC-SHA256 of the **exact raw request bytes**, using the customer's signing secret
as the HMAC key. Whitespace, property order and non-ASCII UTF-8 bytes are signed as
sent; parsing and reserializing JSON is not an equivalent signature input.
Header names are case-insensitive. Missing or invalid signatures must reject the
request before any destination call. Do not trust unsigned payload fields.

A valid order event has this shape:

```json
{
  "type": "order.created",
  "order": {
    "id": "order/42",
    "customer": { "email": "buyer@example.test" },
    "total": 12.375
  }
}
```

`order.id` is an opaque nonempty string, `customer.email` a string, and `total` a
number. Deliver only `order.created`; other signed event types such as
`order.canceled` or `test` are acknowledged without destination processing.
Malformed order.created data is a failure, not a fabricated order.

## Destination

Each customer configures a destination base URL and secret bearer token. POST to
that URL plus `/orders`, using `Authorization: Bearer <token>`, JSON content type,
and `Idempotency-Key: <order.id>`. The body is:

```json
{ "externalId": "order/42", "email": "buyer@example.test", "amount": 12.375 }
```

Preserve the source ID and numeric amount without rounding or string formatting.
Success is HTTP 201 JSON `{ "receiptId": "receipt-1", "externalId": "order/42" }`.
Non-2xx responses are failed deliveries and must not be represented as success.
The destination deduplicates repeated identical bodies under the same
Idempotency-Key, returning the original receipt without creating another order.
This case does not require an automatic retry policy. Secrets must not appear in
returned data or logs.
