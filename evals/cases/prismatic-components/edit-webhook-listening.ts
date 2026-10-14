import assert from "node:assert/strict";
import spectral from "@prismatic-io/spectral";
import type { EditCheck, Json } from "./_check-edit.ts";

const { testing } = spectral;

import { resolve } from "node:path";
import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Our Contact Changed trigger receives events after deployment, but Test Listener receives nothing. Update the existing connector so registration and cleanup work in Listening Mode as well as after deployment. Repeating registration must not create duplicate subscriptions, and two flows must not interfere with one another. Preserve the delivered data. API.md describes our small partner webhook API, including cleanup behavior.",
  ),
  fixtures: "../../fixtures/components/webhooks",
  assertions: [
    {
      id: "component-checks",
      type: "command-exits-zero",
      command: suite.componentCommand(
        "--baseline",
        resolve(import.meta.dirname, "../../fixtures/components/webhooks"),
        "--case",
        resolve(import.meta.dirname, "edit-webhook-listening.ts"),
      ),
    },
    {
      ...suite.trigger,
      criteria:
        "Contact Changed supports webhook registration and cleanup during both Listening Mode and deployment, preserving incoming payloads",
    },
    {
      type: "rubric",
      id: "listening-lifecycle",
      criteria:
        "The registered trigger uses supported Spectral webhook lifecycle create/delete handlers, not just instance deploy/delete callbacks. It uses cross-flow state namespaced by stable flow identity because these webhook handlers lack flow-specific persisted state. Repeated create for an unchanged endpoint avoids another POST; changed endpoints replace old subscriptions. Delete is repeatable, treats remote 404 as already removed, and retains retryable state on genuine API failures. One flow's create/delete cannot clobber another's state. Superseded instance lifecycle code must not double-register subscriptions. Prismatic webhook lifecycle contract: context.webhookUrls is keyed by flow name, so context.webhookUrls[context.flow.name] is the documented endpoint lookup. Persisted crossFlowState ownership should instead use context.flow.stableId, which survives renames and version changes. These keys serve different purposes; do not require webhookUrls to be keyed by stableId. See https://prismatic.io/docs/custom-connectors/triggers/ . The independent component check exercises distinct name, stableId, and versioned id values.",
    },
    {
      ...suite.compatibility,
      criteria:
        "contactChanged trigger key, connection input, apiKey connection, and incoming webhook payload and headers",
    },
  ],
});

export const check: EditCheck = {
  feature: async ({
    component,
    connection,
    calls,
    subscriptions,
    controls,
  }) => {
    const trigger = component.triggers.contactChanged;
    const create =
      trigger.webhookCreate ?? trigger.webhookLifecycleHandlers?.create;
    const remove =
      trigger.webhookDelete ?? trigger.webhookLifecycleHandlers?.delete;
    assert.ok(
      create && remove,
      "Listening Mode requires webhook lifecycle handlers",
    );
    let state: Json = {};
    const revisions = new Map<string, number>();
    const invoke = async (
      handler: typeof create,
      flowId: string,
      endpoint = `https://hooks.example.test/${flowId}`,
    ) => {
      const name = `${flowId} human label`;
      const lifecycle = testing.createHarness({
        ...component,
        triggers: { oracle: { ...trigger, onInstanceDeploy: handler } },
      });
      const invocationState = structuredClone(state);
      const result = await lifecycle.triggerOnInstanceDeploy(
        "oracle",
        { connection },
        {
          crossFlowState: invocationState,
          instanceState: undefined,
          flow: {
            id: `versioned-${flowId}-${revisions.get(flowId) ?? 1}`,
            stableId: flowId,
            name,
          },
          webhookUrls: {
            "Unrelated Flow": "https://hooks.example.test/decoy",
            [name]: endpoint,
          },
        },
      );
      // State commits only after success. Preserve supported context mutations,
      // but returned deltas cross a JSON boundary: undefined is not a tombstone.
      // https://prismatic.io/docs/integrations/persist-data/
      const delta = JSON.parse(JSON.stringify(result?.crossFlowState ?? {}));
      state = JSON.parse(JSON.stringify(invocationState));
      for (const [key, value] of Object.entries(delta)) {
        if (value === null) delete state[key];
        else state[key] = value;
      }
    };
    await invoke(create, "flow-a");
    assert.equal(subscriptions.size, 1);
    assert.deepEqual(
      [...subscriptions.values()],
      ["https://hooks.example.test/flow-a"],
      "Registration used another flow's webhook URL",
    );
    const original = [...subscriptions.keys()][0];
    if (trigger.onInstanceDeploy)
      await invoke(trigger.onInstanceDeploy, "flow-a");
    revisions.set("flow-a", 2);
    await invoke(create, "flow-a");
    assert.equal(
      calls.filter(({ method }) => method === "POST").length,
      1,
      "Repeated create duplicates subscriptions",
    );
    await invoke(create, "flow-b");
    assert.equal(subscriptions.size, 2);
    await invoke(create, "flow-a", "https://hooks.example.test/replacement");
    assert.equal(subscriptions.size, 2);
    assert.ok(
      !subscriptions.has(original),
      "Old endpoint subscription was not removed",
    );
    assert.ok(
      [...subscriptions.values()].includes(
        "https://hooks.example.test/replacement",
      ),
    );
    controls.deleteStatus = 500;
    const beforeFailure = structuredClone(state);
    await assert.rejects(() => invoke(remove, "flow-a"));
    assert.deepEqual(
      state,
      beforeFailure,
      "Failed deletion discarded retry state",
    );
    controls.deleteStatus = 204;
    await invoke(remove, "flow-a");
    assert.deepEqual(
      [...subscriptions.values()],
      ["https://hooks.example.test/flow-b"],
    );
    await invoke(remove, "flow-a");
    controls.deleteStatus = 404;
    await invoke(remove, "flow-b");
    await invoke(remove, "flow-b");
    assert.equal(subscriptions.size, 0);
    controls.deleteStatus = 204;
    await invoke(create, "flow-a", "https://hooks.example.test/replacement");
    await invoke(create, "flow-b");
    assert.deepEqual(
      [...subscriptions.values()].sort(),
      [
        "https://hooks.example.test/replacement",
        "https://hooks.example.test/flow-b",
      ].sort(),
      "Cleanup left stale persisted state that prevents registration restarting",
    );
    await invoke(remove, "flow-a");
    await invoke(remove, "flow-b");
    for (const call of calls.filter(({ method }) => method === "POST"))
      assert.equal(call.body.event, "contact.changed");
  },
};
