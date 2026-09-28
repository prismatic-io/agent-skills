import assert from "node:assert/strict";
import { flow, integration } from "@prismatic-io/spectral";
import { test } from "vitest";
import {
  UnsupportedInterface,
  verifyRegisteredQueue,
} from "./scripts/verify-queue-worker.mjs";

const adapter = {
  flowStableKey: "drain",
  configVars: {
    queueUrl: "$queueUrl",
    queueToken: "$queueToken",
    crmUrl: "$crmUrl",
    crmToken: "$crmToken",
  },
};
// Control independently implements the source contract. Mutants change effects.
const registered = (mutation = "none", nested = false) =>
  integration({
    name: "Queue control",
    flows: [
      flow({
        name: "Drain",
        stableKey: "drain",
        onExecution: async (context) => {
          if (mutation === "managed" || mutation === "swallowed-managed") {
            try {
              await (
                context as unknown as {
                  _components: { invoke: () => Promise<unknown> };
                }
              )._components.invoke();
            } catch (error) {
              if (mutation === "managed") throw error;
            }
          }
          if (mutation === "subflow")
            await context.invokeFlow("another flow", {});
          if (mutation === "hang") await new Promise(() => {});
          const encode = (value: string) =>
            mutation === "equivalent-encoding"
              ? encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, (match) =>
                  match.toLowerCase(),
                )
              : encodeURIComponent(value);
          const vars = context.configVars as Record<string, unknown>;
          const config = (nested ? vars.connection : vars) as Record<
            string,
            string
          >;
          const lease = await fetch(
            `${config.queueUrl}/messages?${mutation === "equivalent-encoding" ? "%6cimit=%31%30" : "limit=10"}`,
            {
              headers: { Authorization: `Bearer ${config.queueToken}` },
            },
          );
          if (!lease.ok) throw new Error("lease");
          const { messages } = await lease.json();
          for (const message of messages) {
            const ack = async () => {
              const result = await fetch(
                `${config.queueUrl}/messages/${mutation === "malformed-receipt" ? "%zz" : encode(message.receipt)}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${config.queueToken}` },
                },
              );
              if (!result.ok && mutation !== "swallow-ack")
                throw new Error("ack");
            };
            if (mutation === "ack-before-write") await ack();
            const write = await fetch(
              `${config.crmUrl}/customers/${mutation === "raw-id" ? message.body.customerId : encode(message.body.customerId)}`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${config.crmToken}`,
                  "Content-Type": "application/json",
                  "Idempotency-Key":
                    mutation === "receipt-key"
                      ? message.receipt
                      : message.body.eventId,
                },
                body: JSON.stringify({
                  active:
                    mutation === "drop-false"
                      ? message.body.active || undefined
                      : message.body.active,
                  email: message.body.email,
                }),
              },
            );
            if (!write.ok) {
              if (mutation === "continue-after-failure") continue;
              throw new Error("write");
            }
            if (mutation !== "ack-before-write") await ack();
          }
          return { data: { arbitraryResult: true } };
        },
      }),
    ],
  });
test("registered queue flow preserves source effects and failure boundaries", async () => {
  const report = await verifyRegisteredQueue(registered(), adapter);
  assert.equal(report.passed, true, JSON.stringify(report.failures));
  assert.equal(report.scenarios, 5);
});
for (const mutant of [
  "ack-before-write",
  "receipt-key",
  "drop-false",
  "raw-id",
  "continue-after-failure",
  "swallow-ack",
  "malformed-receipt",
])
  test(`queue oracle rejects ${mutant}`, async () => {
    assert.equal(
      (await verifyRegisteredQueue(registered(mutant), adapter)).passed,
      false,
    );
  });
test("unreviewed or unavailable interfaces are unsupported", async () => {
  await assert.rejects(
    () => verifyRegisteredQueue(registered(), {}),
    UnsupportedInterface,
  );
  await assert.rejects(
    () =>
      verifyRegisteredQueue(registered(), {
        ...adapter,
        flowStableKey: "missing",
      }),
    UnsupportedInterface,
  );
  await assert.rejects(
    () =>
      verifyRegisteredQueue(registered(), {
        ...adapter,
        configVars: { url: "$queueUrl" },
      }),
    UnsupportedInterface,
  );
});

test("reviewed nested config and reordered JSON fields remain valid", async () => {
  const report = await verifyRegisteredQueue(registered("none", true), {
    ...adapter,
    configVars: { connection: adapter.configVars },
  });
  assert.equal(report.passed, true);
});

for (const variation of ["managed", "swallowed-managed", "subflow"]) {
  test(`missing ${variation} bridge is unsupported, never a behavior failure`, async () => {
    await assert.rejects(
      () => verifyRegisteredQueue(registered(variation), adapter),
      UnsupportedInterface,
    );
  });
}
test("equivalent percent encoding and query spelling preserve effects", async () => {
  const report = await verifyRegisteredQueue(
    registered("equivalent-encoding"),
    adapter,
  );
  assert.equal(report.passed, true, JSON.stringify(report.failures));
});
test("an invocation that does not settle produces an incomplete observation", async () => {
  await assert.rejects(
    () =>
      verifyRegisteredQueue(registered("hang"), {
        ...adapter,
        invocationTimeoutMs: 20,
      }),
    UnsupportedInterface,
  );
});

test("Spectral registry component calls are identified as missing bridges", async () => {
  const component = integration({
    name: "Managed transport",
    componentRegistry: {
      gateway: {
        key: "gateway",
        public: true,
        signature: null,
        actions: { request: { inputs: {}, perform: async () => ({}) } },
        triggers: {},
        dataSources: {},
        connections: {},
      },
    },
    flows: [
      flow({
        name: "Drain",
        stableKey: "drain",
        onExecution: async (context) => {
          const components = context.components as unknown as {
            gateway: { request: (values: object) => Promise<unknown> };
          };
          await components.gateway.request({});
          return { data: {} };
        },
      }),
    ],
  });
  await assert.rejects(
    () => verifyRegisteredQueue(component, adapter),
    /no reviewed bridge for managed component/,
  );
});
