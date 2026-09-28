import { resolve } from "node:path";
import { defineComponentCase } from "./_component-case.ts";

export default defineComponentCase({
  id: "new-museum",
  service: "the supplied Museum API",
  fixture: resolve(import.meta.dirname, "../../fixtures/specs/museum"),
  request:
    "Build a connector from openapi.yaml so I can list special events, buy either a general-admission or special-event ticket, and download the ticket’s QR image to send as an attachment. I only need these three actions. The downloaded image must be usable as a file.",
  persona:
    "You build integrations in Prismatic’s low-code designer and do not write code. You want the requested connector, have no architectural preferences, and can supply real service credentials later. Use mocked service calls now and publish only to the authenticated Prismatic sandbox. The supplied service contract is the source of truth for this exercise.",
  operations: [
    "list special events",
    "buy a general or event ticket",
    "download ticket QR image",
  ],
  tests: [
    "service calls use the configured HTTP Basic credentials required by the supplied spec",
    "both ticket types send their appropriate JSON fields, including eventId for an event ticket",
    "list returns the event collection from the API",
    "download preserves exact non-text PNG bytes and image/png content type",
  ],
  tags: ["openapi", "schema-composition", "binary"],
  contract:
    "Authoritative supplied Museum contract: base https://redocly.com/_mock/docs/openapi/museum-api, global HTTP Basic authentication. GET /special-events returns the event collection. POST /tickets accepts ticketType (general or event), ticketDate (date), optional email, and eventId for event tickets; ticketId is server generated. The ticket response contains ticket details. GET /tickets/{ticketId}/qr returns PNG binary with image/png content type. General admission must work without eventId. Preserve exact non-text bytes and return data usable as a file; Buffer or supported equivalent is valid.",
  criteria: [
    {
      id: "museum-contract",
      criteria:
        "Honor the supplied global HTTP Basic security through a configured connection. Resolve the composed ticket schema: the POST /tickets body contains ticketType, ticketDate, email when supplied, and eventId for event tickets; do not require a server-generated ticketId before buying. GET /tickets/{ticketId}/qr must produce file-usable binary data with image/png content type, not text-decoded bytes or a JSON object pretending to be an image. General tickets must be usable without eventId. Judge runtime behavior, not a specific binary representation or input layout.",
    },
  ],
});
