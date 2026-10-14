import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Our existing Order Relay works, but different customers keep order email and total in different fields. Let the person configuring the integration choose which source fields supply email and amount, without changing code. For example, one customer uses buyer.emailAddress and pricing.grandTotal. Keep the existing customer.email and total behavior as the default so existing customers do not need to reconfigure. The order ID still comes from id. Preserve the existing flows, connection, and other behavior.",
  ),
  persona:
    "You manage customers using the existing Order Relay. Their order data is JSON and nested fields are common. The example customer's fields are buyer.emailAddress and pricing.grandTotal; the original customer.email and total remain the defaults. The destination body still needs externalId, email, and numeric amount, and the order ID always comes from id. Configuration can use any clear supported mapping interface; you have no SDK or library preferences. External-service credentials are not available yet; use local mocks.",
  fixtures: "../../fixtures/integrations/orders",
  assertions: [
    {
      id: "configured-mapping",
      type: "rubric",
      criteria:
        "The existing CNI adds deployer-controlled source-field mapping for destination email and amount and applies it to the actual order delivery. Nested alternate fields work, defaults retain customer.email and total, externalId still uses id, and amount remains numeric without formatting or rounding. Credit the requested valid mappings and backward compatibility first; defensive handling of absent fields is a robustness improvement, not an unstated prerequisite. The mapping is usable without editing source code; equivalent config interfaces are valid, and no particular mapper UI, path syntax or file layout is required.",
    },
    {
      id: "backward-compatibility",
      type: "rubric",
      criteria:
        "Preserve the Relay Order flow stableKey relay-order, Health stableKey order-health and its local ready response, Order Destination connection stableKey order-destination and its baseUrl/token setup, and direct default-schema deliveries. Preserve unrelated behavior and do not leak credentials. New configuration may be additive, but existing configured customers must retain the documented default mapping.",
    },
  ],
});
