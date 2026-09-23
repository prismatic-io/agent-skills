# Partner Records API fixture

This is a fictional, deterministic API contract for local testing. No account or live server exists. Configure the connection's API URL; all endpoints require `Authorization: Bearer <apiKey>`. JSON request/response bodies; errors use non-2xx status and `{ "message": "..." }`.

- `GET /contacts/{id}` returns `{ id: string, name: string, active: boolean, address: { city: string, country: string }, tags: string[], email?: string }`. All fields except email are required; an absent email remains absent.
- `GET /contacts/{id}/review` returns either `{ approved: true, contactId: string, approvedAt: string }` (ISO timestamp) or `{ approved: false, contactId: string, reason: string, retryable: boolean }`.
- `POST /employees` accepts `{ name: string, address: { street: string, city: string, country: string }, metadata?: { externalId: string } }`. Metadata is optional and must be omitted when not supplied. Returns the request fields plus `id: string`.
- `POST /people` accepts `{ firstName: string, lastName: string, email: string }` and returns those fields plus `id: string`.
- `POST /companies` accepts `{ companyName: string, website: string }` and returns those fields plus `id: string`.

The component is installed in existing integrations. Preserve the `apiKey` connection, the four existing action keys and their input keys, outputs, and error behavior. New actions may be added. Preserve baseline.test.ts and its behavior. Install with `npm ci`, then `npm run typecheck`, `npm run build`, and `npm test`. Build output is self-contained under dist/.
