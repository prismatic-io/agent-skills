import { resolve } from "node:path";
import { defineIntegrationCase } from "./_integration-case.ts";

export default defineIntegrationCase({
  id: "verified-order-webhook",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/integrations/webhook-contract",
  ),
  request:
    "Build an integration that receives our partner's order webhooks and sends new orders to each customer's order service. Only genuine order.created events should create an order; other event types should do nothing. The partner signs the exact request bytes, so verify the signature before trusting the contents. Customers must configure their signing secret and destination credentials. API.md describes both sides. There are no live credentials or services here.",
  persona:
    "You operate the partner order feed and want a customer-configured CNI. Order.created is the only event to deliver; canceled and test events are ignored. Each event contains one order. Customers supply their own signing secret, destination URL, and bearer token later. Preserve the order ID, email, and numeric total. Reject unsigned or incorrectly signed requests without sending anything. You have no preference about libraries or code organization; use the supplied API contract and mocked verification.",
  criteria: [
    {
      id: "verified-delivery",
      criteria:
        "The CNI exposes customer configuration for the signing secret, destination URL and secret bearer token. It verifies the supplied HMAC-SHA256 signature over the exact raw request bytes before processing JSON, rejects absent or invalid signatures without destination calls, and only delivers order.created. It POSTs the documented order body using configured authentication and source order ID as Idempotency-Key, preserves numeric values, and propagates unsuccessful delivery rather than reporting success. Equivalent supported implementations are valid; do not require a particular crypto library or trigger arrangement.",
    },
  ],
  validation:
    "a valid signed order produces the authenticated mapped request; a byte-sensitive signature case and an invalid signature discriminate verification; a signed unrelated event sends nothing; a destination failure is visible. Representative combinations are sufficient; no fixed fixture count is required",
  tags: ["webhook", "signature", "customer-config", "idempotency"],
});
