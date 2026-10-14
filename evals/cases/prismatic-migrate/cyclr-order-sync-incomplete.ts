import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/cyclr-order-sync-incomplete/input",
  prompt: suite.prompt(
    "We need to move this Cyclr order workflow to Prismatic. This is the only export we currently have. Work out what can be implemented from it, make useful local progress, and identify what we must recover before replacing the current workflow.",
    "assessment",
  ),
  persona:
    "You own the business workflow but cannot provide any more source files or credentials in this session. You do not know how the Cyclr methods were configured. You want useful progress without a claim that an unverified port is ready to switch on.",
  omitAssertions: ["local-checks"],
  assertions: [
    {
      type: "rubric",
      id: "evidence-and-blockers",
      criteria:
        "The assessment derives source order from Edges, distinguishes known metadata from missing behavior, and explicitly surfaces unresolved trigger semantics and missing method/mapping contracts. It identifies actionable source material or owner answers needed to finish. It does not invent a payload-to-ERP mapping, HTTP endpoint, polling state or webhook contract merely from labels. A useful source inventory with concrete blockers can pass without a generated CNI. This is a legacy parser fixture, not a complete account export. Steps lists destination before trigger, but Edges says step-trigger → step-post. New Order Webhook conflicts with ActionType=1 and Interval=300. m-listen/m-create have no method contracts, payload schema, request mapping, destination path or body. Auth metadata has no credentials; region=us-east has no established mapping.",
    },
    {
      type: "rubric",
      id: "bounded-progress",
      criteria:
        "Any produced scaffold makes unresolved behavior explicit and cannot report successful order transfer through fabricated or no-op destination behavior. The report does not claim completion or equivalence. A justified decision to stop implementation at the evidence boundary can pass; target code quantity is not the objective of this incomplete-source case.",
    },
    suite.assessmentScope,
  ],
});
