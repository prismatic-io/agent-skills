import { resolve } from "node:path";
import { defineEvalCase, subjectPath } from "@prismatic-io/lux";
import { sourceRubrics } from "../_rubric.ts";

export interface IntegrationCase {
  id: string;
  request: string;
  persona: string;
  fixture?: string;
  mode?: "create" | "edit";
  criteria: { id: string; criteria: string }[];
  validation: string;
  preserved?: string;
  tags?: string[];
}

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const rubric = sourceRubrics({
  artifactPatterns: [
    "**/*.ts",
    "**/*.mts",
    "**/*.js",
    "**/*.mjs",
    "**/package.json",
    "**/*.md",
  ],
  sourceGuidance:
    "\n\nThese criteria receive source-focused evidence. Command execution is independently checked by local-checks; do not infer that commands were not run from the terminal-only trace or demand their output here. Judge authored tests by their meaningful coverage.",
  qualityGuidance:
    "Missing a particular test reduces validation confidence, not credit for correctly implemented behavior. Do not require one file layout, library, auth mechanism, or architecture when an equivalent supported approach works. Prefer the actual user-visible request over unstated evaluator preferences. Local mocks establish external-service behavior; actual Prism results establish platform publication. No live external-service verification is required. Generated prose alone does not prove runtime guarantees.",
});

export const defineIntegrationCase = (spec: IntegrationCase) => {
  if (spec.mode === "edit" && !spec.fixture)
    throw new Error("CNI edit cases require an existing project fixture");
  return defineEvalCase({
    id: `prismatic-integrations/${spec.id}`,
    prompt: `${spec.request}\n\nUse the skill at ${subjectPath("prismatic-integrations/SKILL.md")}. ${spec.mode === "edit" ? "Update the integration in this directory, keeping existing customer configuration and unrelated behavior working." : "Build a Code Native Integration in this directory that we can build and test locally."} Publish its component and import a new review copy of the integration into our Prismatic organization. Check that the review copy is available and leave it for us to inspect without overwriting existing components or integrations. Test external services with mocks; do not deploy customer instances or change connected services.`,
    persona: spec.persona,
    ...(spec.fixture
      ? { fixtures: { kind: "dir" as const, path: resolve(spec.fixture) } }
      : {}),
    assertions: [
      { id: "completed", type: "run-succeeded" },
      {
        id: "local-checks",
        type: "command-exits-zero",
        requiresExecutionWorkspace: true,
        command: `node ${quote(resolve(import.meta.dirname, "../_verify-cni.mjs"))}`,
        inheritEnv: ["PATH", "PRISM_ROOT"],
        timeout: "10 minutes",
      },
      ...spec.criteria.map(({ id, criteria }) => rubric(id, criteria)),
      ...(spec.preserved
        ? [rubric("backward-compatibility", spec.preserved)]
        : []),
      rubric(
        "meaningful-tests",
        `Assess meaningful authored verification of the requested behavior. Representative opportunities: ${spec.validation} Score discriminating local tests and contract-faithful mocks proportionally. Existing tests support preservation but do not alone prove new behavior. No fixed test count or framework is required. For platform-owned behavior, inspect registered configuration and public contracts; do not require local emulation of the platform.`,
        false,
        "informational",
      ),
      rubric(
        "handoff",
        "Assess communication and interaction: appropriate business questions, deployer configuration and credentials explained, useful handoff describing changes, material assumptions and actual verification. Technical implementation choices should be researched rather than delegated to a nontechnical requester. A sufficient final message is valid; no separate documentation file, tutorial, exhaustive edge-case catalog, or repetition of unchanged setup is required. Do not deduct again for implementation or test gaps already graded elsewhere unless the handoff independently misrepresents them.",
        true,
      ),
      rubric(
        "platform-publication",
        "Assess actual publication using executed Prism invocations and their results: a fresh CNI component is published, its integration is imported, and the returned integration identity is verified against the requested artifact. Final-message claims or commands written into files alone do not establish publication. Preserve unrelated platform resources and external-service accounts; do not embed real secrets. Distinguish confirmed platform failures from unattempted publication and disclosed blockers.",
        true,
        "required",
      ),
    ],
    meta: {
      skill: "prismatic-integrations",
      tags: [
        "integration-skill",
        spec.mode ?? "create",
        spec.id,
        ...(spec.tags ?? []),
      ],
    },
  });
};
