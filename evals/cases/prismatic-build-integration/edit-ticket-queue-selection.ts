import { resolve } from "node:path";
import { defineIntegrationCase } from "../../integration-case.ts";

export default defineIntegrationCase({
  id: "edit-ticket-queue-selection",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/integrations/tickets"),
  request:
    "Customers want to choose which ticket queues Ticket Mirror sends to the archive. Add a deployer-facing queue chooser populated from the customer's source account, rather than requiring people to type IDs or edit code. The source queue list is paginated. Let a customer select one or more queues; only webhook tickets from those queues should be archived. Existing instances without a queue selection must keep mirroring all queues. Add source credentials to the wizard and preserve the existing archive connection, webhook flow and Health flow. SOURCE.md describes the fictional source; use mocked calls only.",
  persona:
    "You operate Ticket Mirror for customers whose queue IDs differ. The source account exposes queue names and opaque IDs; customers recognize names and may choose several. The existing ticket webhook contains queueId. An absent selection means the old all-queues behavior, including existing configured instances; a configured selection filters to those IDs. The source API uses customer bearer credentials and hasMore/nextCursor pagination, even when a page has no queues. You have no preference for a particular supported data-source or wizard implementation.",
  criteria: [
    {
      id: "ticket-queue-chooser",
      criteria:
        "A customer-facing dynamic queue choice is populated from the authenticated, paginated source account and shows useful names while retaining opaque IDs as values. One or more selected queues control actual registered webhook delivery; unselected queue tickets cause no archive call. An absent selection preserves all-queues behavior and existing Ticket Mirror delivery. Credit equivalent supported CNI config interfaces, with no required data-source function name, page layout, or fixed test count. Source failures remain visible rather than silently presenting a complete empty list.",
    },
  ],
  preserved:
    "Preserve Mirror Ticket stableKey mirror-ticket, existing webhook archive body and Ticket Archive connection stableKey ticket-archive with baseUrl/token, Health stableKey ticket-health and ready response, and all-queues behavior when no new selection exists. New source connection and queue config are additive; do not force existing customers to reconfigure.",
  validation:
    "customer-authenticated two-page queue discovery including an empty continuing page, useful labels/opaque IDs, selected versus unselected registered webhook delivery, absent-selection baseline, source error visibility and Health are representative; do not require one config library pattern",
  tags: [
    "edit",
    "data-source",
    "selection",
    "filtering",
    "backward-compatibility",
  ],
});
