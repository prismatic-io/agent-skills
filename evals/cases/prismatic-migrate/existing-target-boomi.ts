import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

const migration = defineMigrationCase({
  id: "existing-target-boomi",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/existing-target-boomi/input",
  ),
  deliverable: "existing-integration",
  request:
    "Add the attached Boomi order workflow to our existing Prismatic integration. The handover explains the warehouse callback that must continue working. Implement the supported migration locally in the existing project and identify what still blocks replacing Boomi.",
  persona:
    "You own the warehouse integration. Existing customers rely on the receipt flow and its configuration. No further Boomi exports or live credentials are available. Do not replace the existing integration with a second project. You accept useful partial order implementation when missing source dependencies are disclosed.",
  sourceContract:
    "existing-integration is a buildable Spectral CNI with receipt flow stableKey warehouse-receipt-v1 and config variable Receipt Prefix stableKey warehouse-receipt-prefix. Its callback requires nonempty string eventId and warehouse; it returns eventId verbatim, reference <configured prefix>:<warehouse>:<eventId>, status accepted, and throws the source validation messages for missing fields. HANDOVER explicitly requires a separate order entry point in the same project and continued callback identity/behavior. Boomi XML points listener -> NormalizeOrder map -> ERP send; supplied Groovy transforms each document to ORD- plus number, sum qty*unitPrice, US=>NA otherwise INTL (including absent shipTo), preserving document properties and setting region. Map, connection and operation definitions are missing. Separate OTEL SEND has no collector contract. No live cutover is authorized.",
  criteria: [
    {
      id: "extend-without-regression",
      criteria:
        "The agent extends the existing integration rather than producing a replacement scaffold, keeps its receipt entry point and stable identities, retains customer receipt configuration and behavior, and adds a separate order entry point. It does not repurpose receipt payloads as order input or force unrelated receipt customers through new mandatory order configuration merely to run the old flow. Refactoring is allowed if the public behavior and identity survive. Independent receipt verification checks the compiled flow separately.",
    },
    {
      id: "supported-order-port",
      criteria:
        "The new registered order path executes the supported Groovy transformation, including multiple documents, exact region branching and line-item arithmetic. Missing map/ERP/telemetry contracts are acknowledged rather than filled with fabricated successful operations. The agent makes useful local implementation progress without claiming a complete production-equivalent order workflow.",
    },
  ],
  tests:
    "Run the existing receipt regressions and exercise the new order path with every document supplied by one source execution, plus both US and missing/non-US shipping data. Separate single-order test invocations do not demonstrate source document cardinality; target batching, iteration, or fan-out may vary. Verify actual values and show that unsupported ERP delivery does not silently appear complete. Preserve prior callback behavior in the final built project, not only in an unused helper.",
  tags: ["boomi", "existing-target", "regression", "partial-export"],
});

export default {
  ...migration,
  assertions: [
    ...(migration.assertions ?? []),
    {
      id: "existing-receipt-contract",
      type: "command-exits-zero" as const,
      requiresExecutionWorkspace: true,
      command: `node '${resolve(import.meta.dirname, "./_verify-existing-receipt.mjs").replaceAll("'", "'\\''")}'`,
      inheritEnv: ["PATH", "PRISM_ROOT"],
      timeout: "4 minutes",
    },
  ],
};
