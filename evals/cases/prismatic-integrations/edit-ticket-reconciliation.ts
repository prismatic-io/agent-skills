import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Our existing Ticket Mirror handles live webhooks, but a webhook outage can leave the archive behind. Add a customer-configured scheduled reconciliation that reads the ticket source's change feed and upserts changed tickets into the same archive. On the first check, backfill retained tickets. Later checks should continue from saved progress, including across multiple or empty source pages. An archive failure must not silently skip an unconfirmed ticket. Add source credentials and a schedule to the wizard, preserving the existing webhook flow and Health flow. SOURCE.md and API.md describe these services; use mocked calls only.",
  ),
  persona:
    "You operate Ticket Mirror. Webhooks remain the prompt delivery path; reconciliation repairs gaps and may encounter tickets already archived. Customers provide source credentials and choose how often reconciliation runs. SOURCE.md and API.md contain the service details available to you. You want all retained tickets included initially and later checks to resume safely.",
  fixtures: "../../fixtures/integrations/tickets",
  assertions: [
    {
      id: "ticket-reconciliation",
      type: "rubric",
      criteria:
        "The existing CNI gains a customer-configured scheduled reconciliation that authenticates to the source change feed, backfills retained tickets on first run, follows its explicit pagination contract including empty pages, and upserts changed tickets through the existing archive contract. Progress survives later runs and a failed archive/source page does not knowingly advance past unconfirmed work; repeated archive PUTs are safe. Work is bounded per execution or uses a supported continuation mechanism. Equivalent supported trigger/state designs are valid; do not impose a particular cursor storage key or exact page count.",
    },
    {
      id: "backward-compatibility",
      type: "rubric",
      criteria:
        "Preserve Mirror Ticket stableKey mirror-ticket and its current webhook PUT body, Ticket Archive connection stableKey ticket-archive with baseUrl/token, and Health stableKey ticket-health and ready response. Existing webhook-only customers remain usable while new source/schedule setup is added for reconciliation. Import a fresh review copy; do not deploy customer instances or use live service credentials.",
    },
  ],
});
