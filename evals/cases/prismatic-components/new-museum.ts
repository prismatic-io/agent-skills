import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Build a connector from openapi.yaml so I can list special events, buy either a general-admission or special-event ticket, and download the ticket’s QR image to send as an attachment. I only need these three actions. The downloaded image must be usable as a file.",
  ),
  fixtures: "../../fixtures/specs/museum",
  assertions: [
    {
      type: "rubric",
      id: "museum-contract",
      criteria:
        "The requested actions are implemented and registered as usable Spectral actions. Honor the supplied global HTTP Basic security through a configured connection. Resolve the composed ticket schema: the POST /tickets body contains ticketType, ticketDate, email when supplied, and eventId for event tickets; do not require a server-generated ticketId before buying. GET /tickets/{ticketId}/qr must produce file-usable binary data with image/png content type, not text-decoded bytes or a JSON object pretending to be an image. General tickets must be usable without eventId. Judge runtime behavior, not a specific binary representation or input layout. The supplied base is https://redocly.com/_mock/docs/openapi/museum-api. GET /special-events returns the event collection; ticketType is general or event and ticketDate is a date. The ticket response contains ticket details.",
    },
  ],
});
