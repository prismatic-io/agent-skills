import { afterEach, expect, test, vi } from "vitest";
import { defaultTriggerPayload, invokeFlow } from "@prismatic-io/spectral/dist/testing";
import { health, mirrorTicket } from "./flows";

const config = {
  "Ticket Archive": {
    key: "ticket-archive",
    fields: { baseUrl: "https://archive.example.invalid/", token: "archive-token" },
  },
};
const payload = {
  ...defaultTriggerPayload(),
  body: {
    data: { id: "ticket/42", title: "Printer down", status: "open", queueId: "queue/7" },
    contentType: "application/json",
  },
};
afterEach(() => vi.unstubAllGlobals());

test("mirrors a webhook ticket with opaque ID encoding and archive auth", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = await invokeFlow(mirrorTicket, { configVars: config, payload });
  expect(result?.data).toEqual({ mirroredId: "ticket/42" });
  expect(fetchMock).toHaveBeenCalledWith("https://archive.example.invalid/tickets/ticket%2F42", {
    method: "PUT",
    headers: { Authorization: "Bearer archive-token", "Content-Type": "application/json" },
    body: JSON.stringify({ externalId: "ticket/42", title: "Printer down", status: "open" }),
  });
});

test("archive failures remain visible", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
  await expect(invokeFlow(mirrorTicket, { configVars: config, payload })).rejects.toThrow("503");
});

test("Health makes no external call", async () => {
  const fetchMock = vi.fn(() => { throw new Error("Unexpected network call"); });
  vi.stubGlobal("fetch", fetchMock);
  const { result } = await invokeFlow(health, {
    configVars: config,
    payload: defaultTriggerPayload(),
  });
  expect(result?.data).toEqual({ status: "ready" });
  expect(fetchMock).not.toHaveBeenCalled();
});
