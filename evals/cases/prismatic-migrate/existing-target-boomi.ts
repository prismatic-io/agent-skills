import { resolve } from "node:path";
import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/existing-target-boomi/input",
  prompt: suite.prompt(
    "Add the attached Boomi order workflow to our existing Prismatic integration. The handover explains the warehouse callback that must continue working. Implement the supported migration locally in the existing project and identify what still blocks replacing Boomi.",
    "existing-integration",
  ),
  persona:
    "You own the warehouse integration. Existing customers rely on the receipt flow and its configuration. No further Boomi exports or live credentials are available. Do not replace the existing integration with a second project. You accept useful partial order implementation when missing source dependencies are disclosed.",
  assertions: [
    {
      type: "rubric",
      id: "extend-without-regression",
      criteria:
        "The agent extends the existing integration rather than producing a replacement scaffold, keeps its receipt entry point and stable identities, retains customer receipt configuration and behavior, and adds a separate order entry point. It does not repurpose receipt payloads as order input or force unrelated receipt customers through new mandatory order configuration merely to run the old flow. Refactoring is allowed if the public behavior and identity survive. Independent receipt verification checks the compiled flow separately. Receipt flow stableKey is warehouse-receipt-v1; Receipt Prefix config stableKey is warehouse-receipt-prefix. Callback requires nonempty string eventId/warehouse, returns eventId verbatim, reference <prefix>:<warehouse>:<eventId> and status accepted, and preserves source validation messages.",
    },
    {
      type: "rubric",
      id: "supported-order-port",
      criteria:
        "The new registered order path executes the supported Groovy transformation, including every document from one source execution, exact region branching and line-item arithmetic. Missing map/ERP/telemetry contracts are acknowledged rather than filled with fabricated successful operations. The agent makes useful local implementation progress without claiming a complete production-equivalent order workflow. Source orders listener → NormalizeOrder map → ERP send. Per document, prefix order number with ORD-, sum qty × unitPrice, map US to NA and otherwise INTL including missing shipTo, preserve document properties and set region. Map/connection/operation definitions and the separate OTEL collector contract are absent.",
    },
    {
      id: "existing-receipt-contract",
      type: "command-exits-zero",
      requiresExecutionWorkspace: true,
      command: [
        process.execPath,
        resolve(import.meta.dirname, "./_verify-existing-receipt.mjs"),
      ],
      inheritEnv: ["PATH"],
      timeout: "4 minutes",
    },
  ],
});
