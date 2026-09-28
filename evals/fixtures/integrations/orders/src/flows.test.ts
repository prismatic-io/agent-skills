import { afterEach, expect, test, vi } from "vitest";
import { defaultTriggerPayload, invokeFlow } from "@prismatic-io/spectral/dist/testing";
import { relayOrder, health } from "./flows";
const config = {
  "Order Destination": {
    key: "order-destination",
    fields: { baseUrl: "https://orders.example.invalid/", token: "test-token" },
  },
};
const payload = {
  ...defaultTriggerPayload(),
  body: {
    data: { id: "o/1", customer: { email: "buyer@example.test" }, total: 12.5 },
    contentType: "application/json",
  },
};
afterEach(() => vi.unstubAllGlobals());
test("relay maps webhook fields and authenticates an idempotent destination request", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ receiptId: "r1", externalId: "o/1" }), { status: 201 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  const { result } = await invokeFlow(relayOrder, { configVars: config, payload });
  expect(result?.data).toEqual({ receiptId: "r1", externalId: "o/1" });
  expect(fetchMock).toHaveBeenCalledWith("https://orders.example.invalid/orders", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "Idempotency-Key": "o/1",
    },
    body: JSON.stringify({ externalId: "o/1", email: "buyer@example.test", amount: 12.5 }),
  });
});
test("destination errors remain failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
  await expect(invokeFlow(relayOrder, { configVars: config, payload })).rejects.toThrow("503");
});
test("health preserves a separate flow without external calls", async () => {
  const fetchMock = vi.fn(() => {
    throw new Error("Unexpected network call");
  });
  vi.stubGlobal("fetch", fetchMock);
  const { result } = await invokeFlow(health, {
    configVars: config,
    payload: defaultTriggerPayload(),
  });
  expect(result?.data).toEqual({ status: "ready" });
  expect(fetchMock).not.toHaveBeenCalled();
});
