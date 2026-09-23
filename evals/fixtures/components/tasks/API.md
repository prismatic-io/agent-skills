# Partner Tasks API fixture

This is a fictional API for local testing. No account or live server exists. All endpoints use the configured API URL and `Authorization: Bearer <apiKey>`. JSON request/response bodies; non-2xx errors contain `{ message: string }`.

- `GET /projects` returns an array of `{ id: string, name: string }`. No pagination. Names are not unique; IDs are stable. Empty arrays are valid.
- `POST /projects/{projectId}/tasks` accepts `{ title: string }` and returns `{ id: string, projectId: string, title: string }`. Encode the project ID as a single URL path segment.

Existing integrations use the `apiKey` connection and `createTask` action with `connection`, `projectId`, and `title` inputs. Preserve those contracts and baseline.test.ts. Install with `npm ci`; verify with `npm run typecheck`, `npm run build`, and `npm test`.
