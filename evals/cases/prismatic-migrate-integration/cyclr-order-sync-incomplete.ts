import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "cyclr-order-sync-incomplete",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/cyclr-order-sync-incomplete/input",
  ),
  deliverable: "assessment",
  request:
    "We need to move this Cyclr order workflow to Prismatic. This is the only export we currently have. Work out what can be implemented from it, make useful local progress, and identify what we must recover before replacing the current workflow.",
  persona:
    "You own the business workflow but cannot provide any more source files or credentials in this session. You do not know how the Cyclr methods were configured. You want useful progress without a claim that an unverified port is ready to switch on.",
  sourceContract:
    "This is a small legacy parser fixture, not a complete real-account export. Steps are listed destination before trigger, but Edges gives step-trigger -> step-post. Trigger is named New Order Webhook while ActionType=1 and Interval=300 are also present; names alone do not resolve trigger semantics. Method IDs m-listen and m-create lack method contracts; request mapping, source payload schema, destination path and body are absent. Connector auth metadata exists but contains no credentials. region variable is us-east; no mapping establishes its use.",
  criteria: [
    {
      id: "evidence-and-blockers",
      criteria:
        "The assessment derives source order from Edges, distinguishes known metadata from missing behavior, and explicitly surfaces unresolved trigger semantics and missing method/mapping contracts. It identifies actionable source material or owner answers needed to finish. It does not invent a payload-to-ERP mapping, HTTP endpoint, polling state or webhook contract merely from labels. A useful source inventory with concrete blockers can pass without a generated CNI.",
    },
    {
      id: "bounded-progress",
      criteria:
        "Any produced scaffold makes unresolved behavior explicit and cannot report successful order transfer through fabricated or no-op destination behavior. The report does not claim completion or equivalence. A justified decision to stop implementation at the evidence boundary can pass; target code quantity is not the objective of this incomplete-source case.",
    },
  ],
  tests:
    "Verification substantiates the assessment against actual fields and edges in cycle.json, including the reverse Steps order and unresolved trigger/method configuration. If code is produced, test any supported behavior and ensure blocked paths cannot silently report successful delivery. No requirement to invent behavior to satisfy tests.",
  tags: ["cyclr", "incomplete-source"],
});
