import { testing } from "@prismatic-io/spectral";
import { expect, test } from "vitest";
import component from "./src/index";

const harness = testing.createHarness(component);
test("Contact Changed preserves webhook payload", async () => {
  const data = { event: "contact.changed", contact: { id: "c1", name: "Ada" } };
  const result = await harness.trigger("contactChanged", {
    body: { data, contentType: "application/json" },
    headers: { "x-delivery-id": "d1" },
  });
  expect(result?.payload.body.data).toEqual(data);
  expect(result?.payload.headers["x-delivery-id"]).toBe("d1");
});
test("Connection and trigger keys remain stable", () => {
  expect(component.connections.map((item) => item.key)).toContain("apiKey");
  expect(component.triggers.contactChanged.scheduleSupport).toBe("invalid");
});
