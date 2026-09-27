# Order source subscription API

This fictional source is used through HTTP mocks, never a live service.
Customers provide a source base URL and bearer token, distinct from the destination.
Requests use `Authorization: Bearer <token>` and JSON.

- `POST /subscriptions` accepts `{ "url": "https://callback", "event": "order.created" }`
  and returns 201 `{ "id": "sub-123", "url": "https://callback", "event": "order.created" }`.
  An `Idempotency-Key` identifies one create operation: retrying the same key/body
  returns the same subscription. Reusing a key with a different body returns 409.
- `GET /subscriptions` returns `{ "items": [{ "id": "sub-123", "url": "https://callback", "event": "order.created" }] }`.
  This small account-scoped list is complete; it may include subscriptions belonging
  to other integrations, which must not be removed.
- `DELETE /subscriptions/{id}` returns 204. A missing subscription returns 404,
  which also means it is absent. Other errors must remain visible for recovery.
- Subscriptions cannot be updated in place. A changed callback requires replacement.
- Events deliver the order JSON described in API.md directly as the request body.
  The provider supports only the configured event for each subscription.

The service exposes no other subscription endpoints or automatic cleanup.
