import { resolve } from "node:path";
import { defineIntegrationCase } from "./_integration-case.ts";

export default defineIntegrationCase({
  id: "edit-ticket-shared-ingress",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/integrations/tickets"),
  request:
    "Our ticket provider now sends ticket.updated and ticket.deleted notifications, but it allows only one callback URL per customer. Extend the existing Ticket Mirror CNI so one configured callback can handle both notifications: updates refresh the ticket in the archive, and deletes remove it there. Customers already sending the original raw-ticket webhook to Mirror Ticket must remain supported. Keep the archive connection and Health behavior. INGRESS.md and API.md describe the fictional requests and archive operations; use local mocked verification only.",
  persona:
    "You maintain Ticket Mirror for customer accounts. The provider will register exactly one callback URL per account for the new event stream, carrying either event type in a JSON envelope. An updated ticket uses the existing archive shape; a deleted ticket needs the archive's delete operation. The existing direct raw-ticket webhook remains in use by older customers. You want a workable CNI handoff and have no preference for a particular endpoint, routing, or flow design. There is no live account, callback registration, or real credential in this task.",
  criteria: [
    {
      id: "multiplexed-ticket-ingress",
      criteria:
        "A locally buildable, registered CNI offers one customer callback path that accepts both documented ticket.updated and ticket.deleted envelopes, uses the selected event to perform the right authenticated archive PUT or DELETE, preserves opaque ticket IDs, and leaves archive failures visible. Existing raw-ticket delivery through Mirror Ticket and Health remain usable. The implementation may use a single flow with internal dispatch, a supported endpoint routing mechanism, or another supported CNI design; no preprocess flow, endpoint type, flow count, or function name is required. Credit correct business outcomes and explain any concrete delivery limit rather than rewarding a named platform feature by itself.",
    },
  ],
  preserved:
    "Preserve Mirror Ticket stableKey mirror-ticket with its legacy raw-ticket archive behavior, Ticket Archive stableKey ticket-archive and baseUrl/token setup, and Health stableKey ticket-health with ready response. Any new callback/flow configuration is additive; no unrelated customer configuration or direct webhook changes are requested.",
  validation:
    "both new envelopes reach one registered callback and cause the correct authenticated PUT or DELETE; archive204/404 deletion semantics, opaque IDs, a failed archive call, legacy raw-ticket delivery and Health are representative. Verify the chosen CNI endpoint routing locally without assuming one implementation pattern",
  tags: ["edit", "shared-ingress", "routing", "backward-compatibility"],
});
