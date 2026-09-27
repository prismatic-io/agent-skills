# Ticket archive contract

This fictional service is used only through local mocks. Each customer configures a base URL and bearer token. `PUT {baseUrl}/tickets/{encodedTicketId}` sends `Authorization: Bearer <token>` and JSON `{ "externalId": string, "title": string, "status": "open" | "resolved" }`. A confirmed write returns HTTP 204 with no body. Repeating the same ticket ID and body returns 204 and retains one archive record. Other statuses and network failures are not confirmation; they must remain visible.

The existing Ticket Mirror webhook receives JSON `{ "id": string, "title": string, "status": "open" | "resolved", "queueId": string }` in the event body. Ticket and queue IDs are opaque nonempty strings; encode an ID used as a URL path segment. Customers may already have configured the `Ticket Archive` connection and the `Mirror Ticket` and `Health` flows; edits must preserve those identities and default delivery.

For deletion, `DELETE {baseUrl}/tickets/{encodedTicketId}` uses the same bearer authorization. HTTP 204 confirms removal; HTTP 404 means already absent and is also a successful deletion outcome. Other statuses and network failures are not confirmation and must remain visible.
