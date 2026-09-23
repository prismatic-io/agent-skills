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

test("Create Task still accepts an existing project ID", async () => {
  response = { id: "t1", projectId: "p/1", title: "Follow up" };
  expect(
    (
      await harness.action("createTask", {
        connection: connection(),
        projectId: "p/1",
        title: "Follow up",
      })
    )?.data,
  ).toEqual(response);
  expect(calls).toEqual([
    {
      method: "POST",
      path: "/projects/p%2F1/tasks",
      body: { title: "Follow up" },
      authorization: "Bearer test-only-key",
    },
  ]);
});
test("Create Task surfaces API failures", async () => {
  status = 403;
  response = { message: "Forbidden" };
  await expect(
    harness.action("createTask", {
      connection: connection(),
      projectId: "p1",
      title: "Task",
    }),
  ).rejects.toThrow();
});
