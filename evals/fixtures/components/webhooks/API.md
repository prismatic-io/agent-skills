# Partner Webhooks API fixture

This is a fictional API for local testing. No account or live server exists. All endpoints use the configured API URL and `Authorization: Bearer <apiKey>`; errors are non-2xx with `{ message: string }`.

- `POST /subscriptions` accepts `{ endpoint: string, event: "contact.changed" }` and returns `{ id: string }`. Each POST creates a new subscription, even for the same endpoint. No list, lookup, or remote idempotency support exists.
- `DELETE /subscriptions/{id}` returns HTTP 204; HTTP 404 means it was already removed.
- A delivered webhook has JSON `{ event: "contact.changed", contact: { id: string, name: string } }` and optional `x-delivery-id` header.

The current trigger works on instance deployment but has no Listening Mode support. Different flows may share the component; each needs its own subscription. Registering twice for the same unchanged endpoint must not create duplicate subscriptions. If the endpoint changes, replace the old subscription. Cleanup should be repeatable, treat a missing remote subscription as already removed, and not remove another flow's subscription. Retain state on genuine deletion failures so a retry can clean up.

Preserve the `apiKey` connection, `contactChanged` trigger and its connection input, and delivered payload behavior. Lifecycle handlers are expected to change; baseline.test.ts only freezes compatible delivery behavior. Install with `npm ci`; verify with `npm run typecheck`, `npm run build`, and `npm test`.
