import { resolve } from "node:path";
import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "edit-webhook-listening",
  service: "Partner Webhooks",
  mode: "edit",
  fixture: resolve(import.meta.dirname, "../fixtures/components/webhooks"),
  request:
    "Our Contact Changed trigger receives events after deployment, but Test Listener receives nothing. Update the existing connector so registration and cleanup work in Listening Mode as well as after deployment. Repeating registration must not create duplicate subscriptions, and two flows must not interfere with one another. Preserve the delivered data. API.md describes our small partner webhook API, including cleanup behavior.",
  persona:
    "You test integrations in the designer before deploying. You have two flows using this trigger and want test subscriptions cleaned up when you stop listening. No live account is available; publish a sandbox copy for review.",
  operations: [],
  trigger:
    "Contact Changed supports webhook registration and cleanup during both Listening Mode and deployment, preserving incoming payloads",
  contract:
    "Prismatic webhook lifecycle contract: context.webhookUrls is keyed by flow name, so context.webhookUrls[context.flow.name] is the documented endpoint lookup. Persisted crossFlowState ownership should instead use context.flow.stableId, which survives renames and version changes. These keys serve different purposes; do not require webhookUrls to be keyed by stableId. See https://prismatic.io/docs/custom-connectors/triggers/ . The independent component check exercises distinct name, stableId, and versioned id values.",
  preserved: [
    "contactChanged trigger key, connection input, apiKey connection, and incoming webhook payload and headers",
  ],
  criteria: [
    {
      id: "listening-lifecycle",
      criteria:
        "The registered trigger uses supported Spectral webhook lifecycle create/delete handlers, not just instance deploy/delete callbacks. It uses cross-flow state namespaced by stable flow identity because these webhook handlers lack flow-specific persisted state. Repeated create for an unchanged endpoint avoids another POST; changed endpoints replace old subscriptions. Delete is repeatable, treats remote 404 as already removed, and retains retryable state on genuine API failures. One flow's create/delete cannot clobber another's state. Superseded instance lifecycle code must not double-register subscriptions.",
    },
  ],
  tests: [
    "lifecycle create followed by repeated create uses one subscription",
    "two flows retain independent subscriptions and cleanup",
    "endpoint change replaces the old subscription",
    "delete with missing state or remote 404 is safe",
    "genuine delete failure preserves state for retry",
    "trigger delivery still preserves payload and headers",
  ],
  tags: ["edit", "webhooks", "lifecycle", "state"],
});
