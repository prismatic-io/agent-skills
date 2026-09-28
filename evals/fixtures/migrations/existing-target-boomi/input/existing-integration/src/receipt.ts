import { flow } from "@prismatic-io/spectral";

export const receiptFlow = flow({
  name: "Acknowledge Warehouse Receipt",
  stableKey: "warehouse-receipt-v1",
  description: "Return the receipt reference expected by warehouse callers",
  onExecution: async (context, params) => {
    const input = params.onTrigger.results.body.data as {
      eventId?: unknown;
      warehouse?: unknown;
    };
    if (typeof input.eventId !== "string" || input.eventId.length === 0) {
      throw new Error("eventId must be a nonempty string");
    }
    if (typeof input.warehouse !== "string" || input.warehouse.length === 0) {
      throw new Error("warehouse must be a nonempty string");
    }
    return {
      data: {
        eventId: input.eventId,
        reference: `${context.configVars["Receipt Prefix"]}:${input.warehouse}:${input.eventId}`,
        status: "accepted",
      },
    };
  },
});
