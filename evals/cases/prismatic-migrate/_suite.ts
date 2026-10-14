import { resolve } from "node:path";
import { type BuiltinAssertion, subjectPath } from "@prismatic-io/lux";
import { defineCase as baseCase } from "../_suite.ts";

export const prompt = (
  request: string,
  deliverable:
    | "integration"
    | "existing-integration"
    | "assessment" = "integration",
): string =>
  `Use the skill at ${subjectPath("prismatic-migrate/SKILL.md")}.\nThe source files are in this directory. ${deliverable === "assessment" ? "Review the supplied material and prepare the requested assessment here, explaining what remains unknown." : deliverable === "existing-integration" ? "Update our existing Prismatic integration here while preserving its other behavior." : "Build the replacement as a Prismatic Code Native Integration in a new project alongside the source files."} ${deliverable === "assessment" ? "This is an assessment; do not change our systems or publish an integration." : "Publish the replacement component and import a new review copy of the integration into our Prismatic organization. Check that it is available and leave it for review without overwriting existing components or integrations. Explain any missing source information that prevents part of the migration from working."} ${deliverable === "assessment" ? "Keep any rehearsal local and synthetic." : "Do not deploy customer instances or change connected services. Use the supplied examples and mocked service calls for local testing."}\n\n${request}`;
export const handoff = {
  id: "handoff",
  type: "rubric",
  criteria:
    "The handoff distinguishes implemented behavior, verified behavior, unresolved source dependencies, and credentials or deployment inputs still needed. Claims of equivalence, production readiness, or delivery guarantees are supported by evidence. It does not ask the user to choose routine implementation details. Any proposed behavior changes are visible rather than silently described as equivalent migration. This criterion assesses truthful reporting, not implementation completeness: accurate disclosure can pass even when a preservation criterion fails. Conversely, a claimed source restriction must be supported by the actual input or documented contract; calling an unsupported narrowing intentional does not make the explanation accurate.",
  evidence: { view: "execution" },
} satisfies BuiltinAssertion;
export const assessmentScope = {
  id: "platform-scope",
  type: "rubric",
  criteria:
    "Assess whether the requested planning deliverables respect the user’s stated access and assessment scope: do not implement a live cutover, change customer configuration, or publish an invented integration. Authored configuration and executed command literals must contain no embedded real credentials. Judge actual invocations and results, not only final claims.",
  evidence: { view: "execution" },
} satisfies BuiltinAssertion;
export const defineCase = baseCase.extend({
  defaults: {
    meta: { skill: "prismatic-migrate", tags: ["train"] },
    assertions: [
      {
        id: "meaningful-tests",
        type: "rubric",
        informational: true,
        evidence: { view: "execution" },
        criteria:
          "Assess verification of the requested migration against the supplied source contracts: meaningful behavior, boundaries and failure/recovery effects exercised through the delivered registered path with contract-faithful local mocks or independent comparisons. Builds, unchanged source execution, copied expected outputs and detached helper tests alone do not establish target behavior. Evidence should respect actual target persistence and invocation semantics. No fixed test inventory, framework or live service access is required; equivalent discriminating methods count. For assessment-only requests or genuinely blocked portions, evidence traced to the supplied packet and documented operations is sufficient without invented implementation or tests. Synthetic rehearsal does not establish live readiness. Distinguish verification gaps from demonstrated implementation defects.",
      },
      {
        id: "local-checks",
        type: "command-exits-zero",
        requiresExecutionWorkspace: true,
        command: [
          process.execPath,
          resolve(import.meta.dirname, "../_verify-cni.mjs"),
        ],
        timeout: "8 minutes",
      },
      handoff,
      {
        id: "platform-scope",
        type: "rubric",
        criteria:
          "Assess actual platform publication from executed Prism invocations and results: the generated CNI component is published and a fresh integration is imported and verified in the target Prismatic organization. Final claims, local builds, or commands merely written into files do not establish publication. Preserve existing platform artifacts and connected-service accounts. Authored source, configuration, and executed command literals contain no embedded real credentials; synthetic fixture values are not real credentials. Distinguish demonstrated platform failures, unattempted publication, and precise source blockers that legitimately prevent a usable artifact. A blocked portion must not be fabricated merely to obtain an import. Report confirmed scope or secret-handling breaches.",
        evidence: { view: "execution" },
      },
    ],
  },
});
