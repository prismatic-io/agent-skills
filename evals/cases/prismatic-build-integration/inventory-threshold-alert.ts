import { resolve } from "node:path";
import { defineIntegrationCase } from "../../integration-case.ts";

export default defineIntegrationCase({
  id: "inventory-threshold-alert",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/integrations/inventory-threshold",
  ),
  request:
    "Our customers want a scheduled warning when a product in their chosen warehouse enters low stock. They choose a nonnegative stock threshold, check cadence, and where warnings go. Our operations team maintains inventory access for all customer instances; routine credential rotation must not require each customer to re-enter or copy the inventory token. Alert on the first observed low quantity and on a later healthy-to-low transition; do not send the same warning on every check. A restock should make a later drop eligible again. The source can have more than one page. If the warning service is unavailable, the next check must not lose the warning. Build a Code Native Integration using the two services in API.md. There are no live credentials or services; use local mocks only.",
  persona:
    "You run inventory operations across customer instances. Your operations team owns and rotates the inventory credential; customers choose their warehouse and threshold and supply their warning-service credentials and cadence. A quantity at or above the chosen threshold is healthy; below it is low. A warehouse's first observed low product deserves a warning. Each later transition from healthy to low deserves one more, including after restock. Preserve the source product identity and quantity in the warning. The scheduled check should eventually inspect every page. You have no preference for schedule API, state layout, HTTP client, connection mechanism, or retry mechanism; use the supplied API contract and supported CNI capabilities.",
  criteria: [
    {
      id: "threshold-transitions",
      criteria:
        "A locally buildable CNI gives customers warehouse, nonnegative threshold, check cadence and warning-service credential configuration. Inventory access is operations-managed across instances so rotating it does not require every customer to re-enter or copy a token. A supported centrally managed credential reference or equivalent approach is valid when the registered configuration and public contract support it; do not require actual platform provisioning or credential rotation here. The CNI reads contract-shaped warehouse stock pages and sends authenticated warnings only when a product first appears low or crosses from healthy to low. Repeated low snapshots do not repeat a warning; a healthy observation resets eligibility for a later drop. It preserves product identity, quantity, threshold and observation time in the documented warning request. Different supported scheduling, client and state approaches are valid.",
    },
    {
      id: "complete-and-recoverable-check",
      criteria:
        "A check follows source pagination to a complete snapshot or otherwise continues bounded work until all pages are observed. An unsuccessful warning remains eligible for retry; state must not silently mark it delivered. Replaying a previously accepted warning with the documented idempotency key is valid. Credit platform-managed scheduling, persistence or retries only when the registered CNI and public contract support them. Do not require one loop, batch size, state key or exact-once transport design.",
    },
  ],
  validation:
    "representative first-low, repeated-low, restock-then-drop, later source page and destination failure/retry behavior using contract-faithful mocked requests; inspect the registered schedule and actual request/state boundary without prescribing fixture counts",
  tags: ["transfer", "cni", "scheduled", "threshold", "customer-config"],
});
