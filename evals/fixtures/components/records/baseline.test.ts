import { createServer, type IncomingMessage } from "node:http";
import { testing } from "@prismatic-io/spectral";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import component from "./src/index";

const harness = testing.createHarness(component);
let baseUrl: string;
let status = 200;
let response: unknown;
let calls: {
  method: string;
  path: string;
  body: unknown;
  authorization?: string;
}[] = [];
const server = createServer(async (req: IncomingMessage, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  calls.push({
    method: req.method ?? "",
    path: req.url ?? "",
    body: body ? JSON.parse(body) : undefined,
    authorization: req.headers.authorization,
  });
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(response));
});
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterEach(() => {
  calls = [];
  status = 200;
  response = undefined;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const connection = () => ({
  key: "apiKey",
  configVarKey: "Partner",
  fields: { baseUrl, apiKey: "test-only-key" },
});

test("Get Contact preserves nested data, absent optional fields, and encoded IDs", async () => {
  response = {
    id: "a/b",
    name: "Ada",
    active: true,
    address: { city: "London", country: "GB" },
    tags: ["customer"],
  };
  expect(
    (
      await harness.action("getContact", {
        connection: connection(),
        contactId: "a/b",
      })
    )?.data,
  ).toEqual(response);
  expect(calls).toEqual([
    {
      method: "GET",
      path: "/contacts/a%2Fb",
      body: undefined,
      authorization: "Bearer test-only-key",
    },
  ]);
});
test("Get Contact preserves optional email when present", async () => {
  response = {
    id: "c1",
    name: "Ada",
    active: false,
    address: { city: "London", country: "GB" },
    tags: [],
    email: "ada@example.test",
  };
  expect(
    (
      await harness.action("getContact", {
        connection: connection(),
        contactId: "c1",
      })
    )?.data,
  ).toEqual(response);
});
test("Review Contact routes approved payload unchanged", async () => {
  response = {
    approved: true,
    contactId: "c1",
    approvedAt: "2026-01-02T03:04:05Z",
  };
  const result = await harness.action("reviewContact", {
    connection: connection(),
    contactId: "c1",
  });
  expect(result).toMatchObject({
    branch: "Approved",
    data: { contactId: "c1", approvedAt: "2026-01-02T03:04:05Z" },
  });
  expect(calls[0].path).toBe("/contacts/c1/review");
});
test("Review Contact routes rejected payload unchanged", async () => {
  response = {
    approved: false,
    contactId: "c2",
    reason: "Missing consent",
    retryable: false,
  };
  const result = await harness.action("reviewContact", {
    connection: connection(),
    contactId: "c2",
  });
  expect(result).toMatchObject({
    branch: "Rejected",
    data: { contactId: "c2", reason: "Missing consent", retryable: false },
  });
});
test("Legacy Create Employee preserves nested JSON and optional metadata", async () => {
  const employee = {
    name: "Ada",
    address: { street: "1 Main St", city: "London", country: "GB" },
    metadata: { externalId: "ext-1" },
  };
  response = { id: "e1", ...employee };
  expect(
    (
      await harness.action("createEmployee", {
        connection: connection(),
        employeeJson: JSON.stringify(employee),
      })
    )?.data,
  ).toEqual(response);
  expect(calls[0]).toMatchObject({
    method: "POST",
    path: "/employees",
    body: employee,
    authorization: "Bearer test-only-key",
  });
});
test("Legacy Create Person sends flat fields", async () => {
  const person = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.test",
  };
  response = { id: "p1", ...person };
  expect(
    (
      await harness.action("createPerson", {
        connection: connection(),
        ...person,
      })
    )?.data,
  ).toEqual(response);
  expect(calls[0]).toMatchObject({
    method: "POST",
    path: "/people",
    body: person,
  });
});
test("API failures remain failures", async () => {
  status = 403;
  response = { message: "Forbidden" };
  await expect(
    harness.action("getContact", { connection: connection(), contactId: "c1" }),
  ).rejects.toThrow();
});
