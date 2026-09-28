# Ticket event ingress contract

This fictional provider is exercised with local mocks only. A customer account can register **one callback URL** for this event stream. Both event types arrive as HTTP POST JSON at that URL. There is no signature, handshake, registration, or account lookup requirement in this exercise; callback setup is outside the requested edit.

An update event is:

```json
{ "type": "ticket.updated", "ticket": { "id": "ticket/42", "title": "Printer restored", "status": "resolved", "queueId": "queue/7" } }
```

A delete event is:

```json
{ "type": "ticket.deleted", "ticketId": "ticket/42" }
```

Ticket IDs are opaque nonempty strings. Only these two envelope types need new behavior. `ticket.updated` uses the same archive PUT body and path as the legacy raw-ticket webhook. `ticket.deleted` removes the archive record using the DELETE operation in API.md. Other event types may be ignored or rejected clearly; they must not be mistaken for a ticket update. The existing Mirror Ticket flow's direct raw-ticket input is still used by older customers and must continue to work. Supported CNI designs may route by event type or handle both within one flow, provided the customer has one usable callback URL for the new stream.
