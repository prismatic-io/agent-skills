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
import { parse } from "yaml";
import { reconcile } from "../../fixtures/migrations/bespoke-membership-reconcile/input/legacy/reconcile.mjs";
import { withComponentWorkspace } from "../prismatic-components/_check-component.ts";
import { resolveCniEntrypoint } from "./_cni-entrypoint.mjs";

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
export const scenarios = [
  "mixed-paged-snapshot",
  "incomplete-snapshot",
  "empty-snapshot",
  "add-failure-and-reconcile",
  "remove-failure-and-reconcile",
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

// Compare observable policy and partial effects, not internal data structures,
// return values, read count, or ordering between independent successful adds.
export const observeMembership = async (invoke, scenario, timeoutMs = 5000) => {
  if (!scenarios.includes(scenario))
    throw new UnsupportedInterface("Unknown scenario");
  const group = "training/eu +α";
  const pages =
    scenario === "empty-snapshot" || scenario === "remove-failure-and-reconcile"
      ? [{ members: [], nextCursor: null }]
      : [
          {
            members: [
              { id: "manual", enabled: true, kind: "employee" },
              { id: "Case/1 +α", enabled: true, kind: "employee" },
              { id: "disabled", enabled: false, kind: "employee" },
              { id: "contractor", enabled: true, kind: "contractor" },
            ],
            nextCursor: "page+/=2",
          },
          {
            members: [
              { id: "Case/1 +α", enabled: true, kind: "employee" },
              { id: "case/1 +α", enabled: true, kind: "employee" },
              { id: "truthy", enabled: "true", kind: "employee" },
            ],
            nextCursor: null,
          },
        ];
  const grants = new Map([
    ["manual", "helpdesk"],
    ["exception", "helpdesk"],
    ["stale-one", "directory-bridge"],
    ["stale-two", "directory-bridge"],
    ["stale-three", "directory-bridge"],
  ]);
  let round = 0;
  let complete = false;
  let count = 0;
  const traces = [];
  let trace;
  const violations = [];
  const serve = (service) => async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = { invalidJson: raw };
    }
    const url = new URL(request.url, "http://localhost");
    const path = canonicalPath(url.pathname);
    const prefix = `/v1/groups/${encodeURIComponent(group)}`;
    const entry = {
      service,
      method: request.method,
      path,
      query: [...url.searchParams.entries()],
      body,
    };
    trace.push(entry);
    const reply = (status, value) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(value === undefined ? undefined : JSON.stringify(value));
    };
    if (++count > 60) return reply(429, {});
    if (request.headers.authorization !== `Bearer ${service}-secret`) {
      violations.push("wrong-service-credential");
      return reply(401, {});
    }
    if (
      service === "directory" &&
      request.method === "GET" &&
      path === `${prefix}/members`
    ) {
      const cursor = url.searchParams.get("cursor");
      if (cursor && cursor !== "page+/=2") return reply(400, {});
      const index = cursor ? 1 : 0;
      if (scenario === "incomplete-snapshot" && index === 1)
        return reply(503, {});
      if (!pages[index]) return reply(400, {});
      if (!pages[index].nextCursor) complete = true;
      return reply(200, pages[index]);
    }
    if (
      service === "access" &&
      request.method === "GET" &&
      path === `${prefix}/grants`
    )
      return reply(200, {
        grants: [...grants].map(([personId, managedBy]) => ({
          personId,
          managedBy,
        })),
      });
    if (
      service === "access" &&
      ["PUT", "DELETE"].includes(request.method) &&
      path.startsWith(`${prefix}/grants/`)
    ) {
      if (!complete) violations.push("write-before-complete-snapshot");
      const segment = path.slice(`${prefix}/grants/`.length);
      if (segment.includes("/")) return reply(400, {});
      const personId = decodeURIComponent(segment);
      if (
        round === 0 &&
        scenario === "add-failure-and-reconcile" &&
        request.method === "PUT" &&
        personId === "case/1 +α"
      )
        return reply(503, {});
      if (
        round === 0 &&
        scenario === "remove-failure-and-reconcile" &&
        request.method === "DELETE" &&
        personId === "stale-two"
      )
        return reply(503, {});
      if (request.method === "PUT") {
        if (body?.managedBy !== "directory-bridge") return reply(400, {});
        grants.set(personId, body.managedBy);
      } else grants.delete(personId);
      return reply(204);
    }
    violations.push("undocumented-request");
    return reply(404, {});
  };
  const directory = createServer(serve("directory"));
  const access = createServer(serve("access"));
  directory.listen(0, "127.0.0.1");
  access.listen(0, "127.0.0.1");
  await Promise.all([once(directory, "listening"), once(access, "listening")]);
  const config = {
    directoryUrl: `http://127.0.0.1:${directory.address().port}`,
    directoryToken: "directory-secret",
    accessUrl: `http://127.0.0.1:${access.address().port}`,
    accessToken: "access-secret",
    group,
  };
  const observations = [];
  try {
    const rounds = scenario.endsWith("-and-reconcile") ? 2 : 1;
    for (round = 0; round < rounds; round++) {
      trace = [];
      traces.push(trace);
      complete = false;
      let outcome = "success";
      try {
        await bounded(() => invoke(config), timeoutMs);
      } catch (error) {
        if (error instanceof UnsupportedInterface) throw error;
        outcome = "failure";
      }
      // Collapse repeated idempotent attempts and reorder independent operations
      // within an uninterrupted same-method phase. Preserve add/delete ordering.
      const phases = [];
      for (const request of trace.filter((item) =>
        ["PUT", "DELETE"].includes(item.method),
      )) {
        if (phases.at(-1)?.method !== request.method)
          phases.push({ method: request.method, requests: [] });
        const key = JSON.stringify(request);
        if (!phases.at(-1).requests.includes(key))
          phases.at(-1).requests.push(key);
      }
      for (const phase of phases) phase.requests.sort();
      observations.push({
        outcome,
        grants: [...grants].sort(([a], [b]) => a.localeCompare(b)),
        phases,
        violations: [...violations],
      });
    }
    return { observations, traces };
  } finally {
    await Promise.all(
      [directory, access].map(
        (server) =>
          new Promise((done) => {
            server.close(done);
            server.closeAllConnections();
          }),
      ),
    );
  }
};

export const verifyRegisteredMembership = async (component, adapter) => {
  if (
    !adapter?.flowStableKey ||
    !adapter.configVars ||
    typeof adapter.configVars !== "object"
  )
    throw new UnsupportedInterface(
      "Supply reviewer-approved flowStableKey and configVars template ($directoryUrl, $directoryToken, $accessUrl, $accessToken, $group)",
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
    !Object.keys({
      directoryUrl: 1,
      directoryToken: 1,
      accessUrl: 1,
      accessToken: 1,
      group: 1,
    }).every((key) => JSON.stringify(adapter.configVars).includes(`$${key}`))
  )
    throw new UnsupportedInterface(
      "Adapter must map all endpoint, credential and group values",
    );
  const timeoutMs = adapter.invocationTimeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
    throw new UnsupportedInterface("invocationTimeoutMs must be 1–60000");
  const failures = [];
  for (const scenario of scenarios) {
    const expected = await observeMembership(reconcile, scenario);
    let unavailable;
    const missingBridge = (service) => {
      unavailable = new UnsupportedInterface(
        `Local checker has no reviewed bridge for ${service}`,
      );
      throw unavailable;
    };
    const observed = await observeMembership(
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
        observed.observations,
        expected.observations,
        "Access policy, snapshot gating or partial effects differ from executable reconciliation",
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
      "Registered action and local HTTP effects; excludes managed component/subflow bridges, trigger preprocessing, deployed scheduling, overlapping runs and real gateway consistency",
  };
};

const main = async () => {
  if (!process.argv[2] || !process.argv[3])
    throw new UnsupportedInterface(
      "Usage: verify-membership-reconcile.mjs <CNI project> <reviewer adapter.json>",
    );
  const project = resolve(process.argv[2]);
  const adapter = JSON.parse(await readFile(resolve(process.argv[3]), "utf8"));
  await withComponentWorkspace(project, async (directory) => {
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
    const report = await verifyRegisteredMembership(component, adapter);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  });
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
