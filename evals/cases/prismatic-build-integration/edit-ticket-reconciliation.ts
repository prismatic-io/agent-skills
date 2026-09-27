import { resolve } from "node:path";
import { defineIntegrationCase } from "../../integration-case.ts";

export default defineIntegrationCase({
  id: "edit-ticket-reconciliation",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/integrations/tickets"),
  request:
    "Our existing Ticket Mirror handles live webhooks, but a webhook outage can leave the archive behind. Add a customer-configured scheduled reconciliation that reads the ticket source's change feed and upserts changed tickets into the same archive. On the first check, backfill retained tickets. Later checks should continue from saved progress, including across multiple or empty source pages. An archive failure must not silently skip an unconfirmed ticket. Add source credentials and a schedule to the wizard, preserving the existing webhook flow and Health flow. SOURCE.md and API.md describe these fictional services; use mocked calls only.",
  persona:
    "You operate Ticket Mirror. The existing webhook remains the low-latency path; reconciliation repairs gaps and may see a ticket already archived by the webhook. The archive PUT is idempotent for the same ticket ID and body. The source gives an opaque per-instance cursor and explicit hasMore, and a cursorless first request starts retained history. Customers provide source credentials and cadence. You do not require a polling versus scheduled-flow architecture, exact batch size, or timing beyond bounded work and safe continuation.",
  criteria: [
    {
      id: "ticket-reconciliation",
      criteria:
        "The existing CNI gains a customer-configured scheduled reconciliation that authenticates to the source change feed, backfills retained tickets on first run, follows its explicit pagination contract including empty pages, and upserts changed tickets through the existing archive contract. Progress survives later runs and a failed archive/source page does not knowingly advance past unconfirmed work; repeated archive PUTs are safe. Work is bounded per execution or uses a supported continuation mechanism. Equivalent supported trigger/state designs are valid; do not impose a particular cursor storage key or exact page count.",
    },
  ],
  preserved:
    "Preserve Mirror Ticket stableKey mirror-ticket and its current webhook PUT body, Ticket Archive connection stableKey ticket-archive with baseUrl/token, and Health stableKey ticket-health and ready response. Existing webhook-only customers remain usable while new source/schedule setup is added for reconciliation. Do not import, deploy or use live service credentials.",
  validation:
    "first cursorless run, a later page including an empty hasMore page, source and archive failures with fresh-invocation progress, repeated ticket upsert, existing webhook, and Health are representative; source data and archive HTTP response wrappers must follow SOURCE.md/API.md",
  tags: [
    "edit",
    "reconciliation",
    "pagination",
    "state",
    "backward-compatibility",
  ],
});
