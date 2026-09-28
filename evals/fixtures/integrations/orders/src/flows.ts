import { flow, type Connection } from "@prismatic-io/spectral";
export interface Order {
  id: string;
  customer: { email: string };
  total: number;
}
export const relayOrder = flow({
  name: "Relay Order",
  stableKey: "relay-order",
  description: "Send an order to the configured destination",
  onExecution: async (context, params) => {
    const order = params.onTrigger.results.body.data as Order;
    const connection = context.configVars["Order Destination"] as Connection;
    const response = await fetch(`${String(connection.fields.baseUrl).replace(/\/$/, "")}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.fields.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": order.id,
      },
      body: JSON.stringify({
        externalId: order.id,
        email: order.customer.email,
        amount: order.total,
      }),
    });
    if (!response.ok) throw new Error(`Order destination returned ${response.status}`);
    return { data: await response.json() };
  },
});
export const health = flow({
  name: "Health",
  stableKey: "order-health",
  description: "Report local integration readiness",
  onExecution: async () => ({ data: { status: "ready" } }),
});
export default [relayOrder, health];
