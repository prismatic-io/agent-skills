# Cedar Desk and audit archive API

These services are fictional and have no live endpoints or credentials. Verify them with local mocks only. Each customer configures a Cedar Desk HTTPS base URL and bearer token, plus a separate audit archive HTTPS base URL and bearer token. The customer also chooses one or more Cedar Desk queue IDs and a check cadence. Queue IDs and ticket IDs are opaque strings; encode an ID used as a URL path segment. Ticket IDs are unique across that customer's queues.

## Cedar Desk changes

`GET {cedarBaseUrl}/queues/{encodedQueueId}/changes` uses `Authorization: Bearer <cedarToken>`. Each queue has its own opaque cursor. A request without a cursor establishes the position for a newly watched queue: Cedar Desk responds HTTP 412 with `{ "data": { "next": "cursor-1" } }`. It does **not** return historical changes. A request with an expired cursor has the same 412 response shape with a fresh `next` cursor; changes before that new position cannot be replayed. The cursor is an opaque token, not a timestamp or count.

A request with a valid cursor supplies it as the `cursor` query parameter and receives HTTP 200:

```json
{
  "data": {
    "changes": [
      {
        "kind": "ticket.resolved",
        "ticketId": "ticket/42",
        "queueId": "queue-7",
        "title": "Printer restored",
        "resolvedAt": "2026-09-27T12:30:00Z"
      }
    ],
    "next": "cursor-2",
    "hasMore": false
  }
}
```

`kind` is either `ticket.resolved` or `ticket.updated`. Only resolved changes have a meaningful `resolvedAt`; an update must not be archived. Every returned change belongs to the requested queue. When `hasMore` is true, request another page using `next`. When false, `next` is the position for a later check. A page can be empty, and another page or later check can contain new changes. A customer may watch multiple queues, whose positions are independent. A non-2xx response other than the documented 412 is a source failure.

## Audit archive

`PUT {archiveBaseUrl}/tickets/{encodedTicketId}` uses `Authorization: Bearer <archiveToken>` and JSON body `{ "queueId": string, "title": string, "resolvedAt": string }` using the Cedar Desk values without changing the resolution time. The archive returns HTTP 204 after persisting the record. Repeating the same ticket ID and body returns 204 and retains one record. An unsuccessful HTTP status or network failure is not confirmation of a write and must remain visible for recovery. The archive has no list endpoint and cannot repair a source cursor that expired before a resolution was read.
