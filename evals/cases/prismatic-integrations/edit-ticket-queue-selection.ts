import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Customers want to choose which ticket queues Ticket Mirror sends to the archive. Add a deployer-facing queue chooser populated from the customer's source account, rather than requiring people to type IDs or edit code. The source queue list is paginated. Let a customer select one or more queues; only webhook tickets from those queues should be archived. Existing instances without a queue selection must keep mirroring all queues. Add source credentials to the wizard and preserve the existing archive connection, webhook flow and Health flow. SOURCE.md describes the source; use mocked calls only.",
  ),
  persona:
    "You operate Ticket Mirror for customers whose queue IDs differ. Customers recognize queue names and may choose several. An absent selection must preserve the existing all-queues behavior. The service details are in SOURCE.md. You want a usable chooser and reliable filtering, with no preference about its implementation.",
  fixtures: "../../fixtures/integrations/tickets",
  assertions: [
    {
      id: "ticket-queue-chooser",
      type: "rubric",
      criteria:
        "A customer-facing dynamic queue choice is populated from the authenticated, paginated source account and shows useful names while retaining opaque IDs as values. One or more selected queues control actual registered webhook delivery; unselected queue tickets cause no archive call. An absent selection preserves all-queues behavior and existing Ticket Mirror delivery. Credit equivalent supported CNI config interfaces, with no required data-source function name, page layout, or fixed test count. Source failures remain visible rather than silently presenting a complete empty list.",
    },
    {
      id: "backward-compatibility",
      type: "rubric",
      criteria:
        "Preserve Mirror Ticket stableKey mirror-ticket, existing webhook archive body and Ticket Archive connection stableKey ticket-archive with baseUrl/token, Health stableKey ticket-health and ready response, and all-queues behavior when no new selection exists. New source connection and queue config are additive; do not force existing customers to reconfigure.",
    },
  ],
});
