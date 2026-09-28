import { resolve } from "node:path";
import { defineIntegrationCase } from "./_integration-case.ts";

export default defineIntegrationCase({
  id: "edit-webhook-lifecycle",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../../fixtures/integrations/orders"),
  request:
    "Customers currently configure the Order Relay webhook manually. Update this existing CNI so deploying an instance automatically subscribes Relay Order to order.created events from the source service, and deleting the instance cleans up its subscription. Redeploying or changing settings must not leave duplicate or stale subscriptions. Add source credentials to the configuration wizard. Keep the existing order delivery and Health behavior. SOURCE.md describes the source API; use mocked calls only.",
  persona:
    "You own this customer integration. Customers should no longer copy callback URLs. Only order.created events are wanted. Preserve the current destination and order format. No real credentials are available, and platform deployment or live service calls are outside this request. No designer listening-mode subscription is requested. Choose technical details from the service contract.",
  criteria: [
    {
      id: "subscription-lifecycle",
      criteria:
        "Registered CNI lifecycle behavior uses the actual Relay Order callback URL and configured source credentials to establish an order.created subscription. Repeated deployment and callback/settings changes do not knowingly leak duplicate/stale subscriptions; instance deletion removes the owned subscription. State and service behavior support recovery after a failed lifecycle call. Do not require one hook family, storage key, or algorithm when the documented lifecycle and API contracts support equivalent behavior. Evaluate partial lifecycle implementation proportionally; listening mode is not requested.",
    },
  ],
  preserved:
    "Preserve Relay Order and Health flow identities, destination connection identity and existing order delivery contract from API.md. Existing customer configuration and unrelated behavior must remain usable. New source configuration is allowed; wholesale replacement or a new project is not requested.",
  validation:
    "Repeated deployment, changed callback or source settings, deletion, and a failed subscription request. Existing mocked order delivery and Health checks support compatibility. No specific test count is required.",
  tags: ["lifecycle", "compatibility"],
});
