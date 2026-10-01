#!/usr/bin/env node
// Reviewer-owned HTTP oracle. Adapters describe configuration, never expected effects.
// Supported: one registered action issuing HTTP directly through fetch/axios/node:http.
// Managed components, subflow invocation, trigger preprocessing and deployed scheduling
// need additional reviewed bridges; missing bridges are unsupported, never a bad port.
// HTTP comparison normalizes path segment encoding, query encoding and JSON key order.
// Cooperative invocation timeout cannot preempt a synchronous CPU loop: run this CLI
// with an outer process deadline. CLI exits after incomplete checks to stop pending work.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parse } from "yaml";
import { drainOnce } from "../../fixtures/migrations/bespoke-queue-worker/input/legacy/worker.mjs";
import { resolveCniEntrypoint } from "../_cni-entrypoint.mjs";

export class UnsupportedInterface extends Error {}
const canonicalPath = (path) =>
  path
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return segment;
      }
    })
    .join("/");
const bounded = async (invoke, timeoutMs) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(invoke),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new UnsupportedInterface(
                `Local invocation exceeded ${timeoutMs}ms; observation incomplete, not a behavioral verdict`,
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const messages = [
  {
    receipt: "lease/first +α",
    body: {
      eventId: "event-first",
      customerId: "customer/α +",
      email: "one@example.test",
      active: false,
    },
  },
  {
    receipt: "lease/second",
    body: {
      eventId: "event-second",
      customerId: "customer-2",
      email: "two@example.test",
      active: true,
    },
  },
  {
    receipt: "lease/third",
    body: {
      eventId: "event-third",
      customerId: "customer-3",
      email: "three@example.test",
      active: false,
    },
  },
];
export const scenarios = [
  "success",
  "empty",
  "lease-failure",
  "second-write-failure",
  "ack-failure-and-redelivery",
];
const logger = { info() {}, warn() {}, error() {}, debug() {}, metric() {} };
const fill = (value, replacements) => {
  if (typeof value === "string") return replacements[value] ?? value;
  if (Array.isArray(value))
    return value.map((item) => fill(item, replacements));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        fill(item, replacements),
      ]),
    );
  return value;
};

// Actual HTTP works with fetch, axios and node:http; no subject test/helper is loaded.
export const observeQueue = async (invoke, scenario, timeoutMs = 5000) => {
  const trace = [];
  const effects = new Map();
  const acknowledged = new Set();
  let round = 0;
  let count = 0;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    let parsedBody = null;
    try {
      parsedBody = body ? JSON.parse(body) : null;
    } catch {
      parsedBody = { invalidJson: body };
    }
    const url = new URL(request.url, "http://localhost");
    const service = url.pathname.startsWith("/queue/") ? "queue" : "crm";
    const path = canonicalPath(url.pathname.replace(/^\/(queue|crm)/, ""));
    const entry = {
      method: request.method,
      service,
      path,
      query: [...url.searchParams.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
      authorization: request.headers.authorization,
      idempotencyKey: request.headers["idempotency-key"],
      body: parsedBody,
    };
    trace.push(entry);
    const reply = (status, value) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(value === undefined ? undefined : JSON.stringify(value));
    };
    if (++count > 30) return reply(429, {});
    if (request.headers.authorization !== `Bearer ${service}-secret`)
      return reply(401, {});
    if (
      service === "queue" &&
      request.method === "GET" &&
      path === "/messages"
    ) {
      if (scenario === "lease-failure") return reply(503, {});
      const batch =
        scenario === "empty"
          ? []
          : messages
              .filter((message) => !acknowledged.has(message.body.eventId))
              .map((message) => ({
                ...message,
                receipt: round
                  ? `${message.receipt}/redelivered`
                  : message.receipt,
              }));
      return reply(200, { messages: batch });
    }
    if (service === "crm" && request.method === "PUT") {
      if (
        scenario === "second-write-failure" &&
        path === `/customers/${encodeURIComponent(messages[1].body.customerId)}`
      )
        return reply(503, {});
      const key = request.headers["idempotency-key"];
      if (effects.has(key) && !isDeepStrictEqual(effects.get(key), parsedBody))
        return reply(409, {});
      effects.set(key, parsedBody);
      return reply(204);
    }
    if (service === "queue" && request.method === "DELETE") {
      if (scenario === "ack-failure-and-redelivery" && round === 0)
        return reply(409, {});
      let receipt;
      try {
        receipt = decodeURIComponent(path.slice("/messages/".length));
      } catch {
        return reply(400, {});
      }
      const message = messages.find(
        (item) =>
          receipt === (round ? `${item.receipt}/redelivered` : item.receipt),
      );
      if (!message) return reply(409, {});
      acknowledged.add(message.body.eventId);
      return reply(204);
    }
    return reply(404, {});
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = {
    queueUrl: `${base}/queue/`,
    queueToken: "queue-secret",
    crmUrl: `${base}/crm/`,
    crmToken: "crm-secret",
  };
  // Legacy constructs absolute paths. Separate loopback ports preserve service identity.
  const crmServer = createServer((req, res) => {
    req.url = `/crm${req.url}`;
    server.emit("request", req, res);
  });
  const queueServer = createServer((req, res) => {
    req.url = `/queue${req.url}`;
    server.emit("request", req, res);
  });
  crmServer.listen(0, "127.0.0.1");
  queueServer.listen(0, "127.0.0.1");
  await Promise.all([
    once(crmServer, "listening"),
    once(queueServer, "listening"),
  ]);
  config.crmUrl = `http://127.0.0.1:${crmServer.address().port}`;
  config.queueUrl = `http://127.0.0.1:${queueServer.address().port}`;
  const outcomes = [];
  try {
    const rounds = scenario === "ack-failure-and-redelivery" ? 2 : 1;
    for (round = 0; round < rounds; round++) {
      try {
        await bounded(() => invoke(config), timeoutMs);
        outcomes.push("success");
      } catch (error) {
        if (error instanceof UnsupportedInterface) throw error;
        outcomes.push("failure");
      }
    }
    return {
      trace,
      outcomes,
      effects: [...effects],
      acknowledged: [...acknowledged],
    };
  } finally {
    await Promise.all(
      [server, crmServer, queueServer].map(
        (item) =>
          new Promise((done) => {
            item.close(done);
            item.closeAllConnections();
          }),
      ),
    );
  }
};

export const verifyRegisteredQueue = async (component, adapter) => {
  if (
    !adapter?.flowStableKey ||
    !adapter.configVars ||
    typeof adapter.configVars !== "object"
  )
    throw new UnsupportedInterface(
      "Supply reviewer-approved flowStableKey and configVars template ($queueUrl, $queueToken, $crmUrl, $crmToken)",
    );
  const definition = parse(component.codeNativeIntegrationYAML ?? "");
  const flow = definition?.flows?.find(
    (item) => item.stableKey === adapter.flowStableKey,
  );
  const step = flow?.steps?.find(
    (item) => !item.isTrigger && item.action?.component?.key === component.key,
  );
  const execute = component.actions?.[step?.action?.key]?.perform;
  if (typeof execute !== "function")
    throw new UnsupportedInterface(
      "Selected flow has no directly invocable registered action",
    );
  if (
    !Object.keys({ queueUrl: 1, queueToken: 1, crmUrl: 1, crmToken: 1 }).every(
      (key) => JSON.stringify(adapter.configVars).includes(`$${key}`),
    )
  )
    throw new UnsupportedInterface(
      "Adapter must map all four endpoint and credential values",
    );
  const timeoutMs = adapter.invocationTimeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
    throw new UnsupportedInterface("invocationTimeoutMs must be 1–60000");
  const failures = [];
  for (const scenario of scenarios) {
    const expected = await observeQueue(drainOnce, scenario);
    let unavailable;
    const missingBridge = (service) => {
      unavailable = new UnsupportedInterface(
        `Local checker has no reviewed bridge for ${service}`,
      );
      throw unavailable;
    };
    const observed = await observeQueue(
      async (config) => {
        let result;
        try {
          result = await execute(
            {
              configVars: fill(
                adapter.configVars,
                Object.fromEntries(
                  Object.entries(config).map(([key, value]) => [
                    `$${key}`,
                    value,
                  ]),
                ),
              ),
              instanceState: {},
              crossFlowState: {},
              executionState: {},
              integrationState: {},
              globalDebug: false,
              logger,
              _components: {
                invoke: () => missingBridge("managed component invocation"),
                invokeTrigger: () =>
                  missingBridge("managed trigger invocation"),
              },
              webhookUrls: new Proxy(
                {},
                { get: () => missingBridge("subflow invocation") },
              ),
            },
            { onTrigger: { results: { body: { data: {} } } } },
          );
        } catch (error) {
          throw unavailable ?? error;
        }
        // Subjects may catch platform errors. A swallowed missing bridge still
        // makes this observation incomplete rather than a behavioral failure.
        if (unavailable) throw unavailable;
        return result;
      },
      scenario,
      timeoutMs,
    );
    try {
      assert.deepEqual(
        observed,
        expected,
        "HTTP effects, acknowledgement order or failure outcome differ from the executable worker",
      );
    } catch (error) {
      failures.push({ scenario, message: error.message, expected, observed });
    }
  }
  return {
    passed: failures.length === 0,
    scenarios: scenarios.length,
    failures,
    scope:
      "Registered action and local HTTP effects; excludes managed component/subflow bridges, trigger preprocessing, deployed scheduling, overlapping runs and real lease expiration",
  };
};

const main = async () => {
  if (!process.argv[2] || !process.argv[3])
    throw new UnsupportedInterface(
      "Usage: verify-queue-worker.mjs <CNI project> <reviewer adapter.json>",
    );
  const project = resolve(process.argv[2]);
  const adapter = JSON.parse(await readFile(resolve(process.argv[3]), "utf8"));
  // Run inside the disposable verification workspace supplied by Lux.
  const directory = project;
  const build = spawnSync("npm", ["run", "build"], {
    cwd: directory,
    stdio: "inherit",
    timeout: 180000,
  });
  assert.ifError(build.error);
  assert.equal(
    build.status,
    0,
    "Generated project must build before behavioral checking",
  );
  const entrypoint = await resolveCniEntrypoint(directory);
  let component = await import(pathToFileURL(entrypoint).href);
  for (
    let i = 0;
    i < 3 && !component.codeNativeIntegrationYAML && component.default;
    i++
  )
    component = component.default;
  const report = await verifyRegisteredQueue(component, adapter);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
};
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exit(error instanceof UnsupportedInterface ? 2 : 1);
  }
}
