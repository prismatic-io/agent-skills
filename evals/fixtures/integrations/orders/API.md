# Order Relay service contract

This fictional destination is not live. Verification uses mocked HTTP only.

Relay Order accepts a JSON webhook body with `id` (opaque string), `customer.email` (string), and `total` (number). It posts to the configured destination base URL plus `/orders`, authenticating with `Authorization: Bearer <token>`. The JSON body contains `externalId` from id, `email` from customer.email, and `amount` from total; retain the number without formatting or rounding. Successful creation returns HTTP 201 JSON `{ "receiptId": "r1", "externalId": "o1" }`. A non-2xx response is a failed delivery and must not be reported as success.

The destination supports `Idempotency-Key` with the source order id. Repeating the same key and body returns the original receipt and creates no additional order. This baseline processes one order per invocation and does not automatically retry failed requests.

The existing `Relay Order` flow has stable key `relay-order`; `Health` has stable key `order-health` and returns `{status:"ready"}` without external requests. `Order Destination` is a customer-owned connection with stable key `order-destination`, containing baseUrl and secret bearer token. Credentials must not appear in returned data or logs.
