# Private service contracts

Both services use `Authorization: Bearer <token>` with separate credentials.
Paths are relative to the supplied service origin. JSON requests use
`Content-Type: application/json`.

## Shop change feed

`GET /changes?after=<opaque cursor>` returns `orders`, `next_cursor`, and
`has_more`. It returns stable pages for a given cursor during the seven-day
retention window. Cursor values are opaque and must be URL encoded. A response
advances the cursor even when orders is empty. When has_more is false, save the
returned cursor and poll from there on the next scheduled run. This is an
exclusive continuation token, not a timestamp comparison on the client.

Orders contain id, status, currency, customer.email, and items. Each item has
sku, quantity (integer), and unit_price_cents (integer). The feed can contain
pending or cancelled orders. Updates to an existing ID appear as a later change.
The sample page shows a two-line paid order and a cancelled order.

## Fulfillment

`PUT /orders/<URL-encoded external ID>` atomically upserts one order. Body fields
are externalId, customerEmail, currency, and lines. Lines contain sku, quantity,
and unitPriceCents; the amount is per unit, not a line total. Repeating an ID is
safe, including after an uncertain response. Success returns 204. Invalid orders
return 422; expired tokens return 401. Neither is transient.

Both services may return 429 or 503 with Retry-After expressed in seconds.
This script attempts at most three requests for those statuses. Network failures
and timeouts cause the scheduled job to fail. No other automatic retry contract
is provided by these services.
