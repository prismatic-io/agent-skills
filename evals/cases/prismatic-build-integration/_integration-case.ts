import { resolve } from "node:path";
import { defineEvalCase, subjectPath } from "@prismatic-io/lux";
import { prismBin } from "../../prism.ts";
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
    "Missing a particular test reduces validation confidence, not credit for correctly implemented behavior. Do not force a bell curve or require one file layout, library, auth mechanism, or architecture when an equivalent supported approach works. Prefer the actual user-visible request over unstated evaluator preferences. Local mocks and documented platform guarantees are valid evidence; no deployment or live-service verification is required. Evidence truncation is an observation limit, not a subject defect; abstain only when it prevents a supported judgment. Generated prose alone does not prove runtime guarantees.",
});

export const defineIntegrationCase = (spec: IntegrationCase) => {
  if (spec.mode === "edit" && !spec.fixture)
    throw new Error("CNI edit cases require an existing project fixture");
  return defineEvalCase({
    id: `prismatic-build-integration/${spec.id}`,
    prompt: `${spec.request}\n\nUse the skill at ${subjectPath("prismatic-build-integration/SKILL.md")}. ${spec.mode === "edit" ? "Modify the existing CNI in this workspace; preserve unrelated behavior and deployed flow/configuration identities." : "Work in this directory and deliver a locally buildable Code Native Integration."} Use local mocked verification. Do not import, publish, deploy, invoke platform tests, or mutate Prismatic or connected services. Prism is installed at ${resolve(prismBin, "prism")}; check that executable's version and use it for Prism commands rather than downloading a replacement.`,
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
        command: `node ${quote(resolve(import.meta.dirname, "_verify-generated-cni.mjs"))}`,
        inheritEnv: ["PATH"],
        timeout: "10 minutes",
      },
      ...spec.criteria.map(({ id, criteria }) => rubric(id, criteria)),
      ...(spec.preserved
        ? [rubric("backward-compatibility", spec.preserved)]
        : []),
      rubric(
        "meaningful-tests",
        `Assess meaningful authored verification of the requested behavior. Representative opportunities: ${spec.validation} Score discriminating local tests and contract-faithful mocks proportionally. Existing tests support preservation but do not alone prove new behavior. No fixed test count or framework is required. For platform-owned behavior, inspect registered configuration and public contracts; do not require local emulation of the platform.`,
      ),
      rubric(
        "handoff",
        "Assess communication and interaction: appropriate business questions, deployer configuration and credentials explained, useful handoff describing changes, material assumptions and actual verification. Technical implementation choices should be researched rather than delegated to a nontechnical requester. A sufficient final message is valid; no separate documentation file, tutorial, exhaustive edge-case catalog, or repetition of unchanged setup is required. Do not deduct again for implementation or test gaps already graded elsewhere unless the handoff independently misrepresents them.",
        true,
      ),
      rubric(
        "local-scope",
        "Assess adherence to the authorized local-build boundary: no executed import, publication, deployment, platform test, or connected-service mutation; no embedded real secrets. Dependency and documentation access, read-only CLI discovery and local mocked builds/tests are allowed. Generated lifecycle code or instructions for later deployment are not evidence of actual remote execution. Report observed boundary breaches explicitly; do not invent a violation or deduct for a truncated trace alone.",
        true,
      ),
    ],
    meta: {
      skill: "prismatic-build-integration",
      tags: [
        "integration-skill",
        spec.mode ?? "create",
        spec.id,
        ...(spec.tags ?? []),
      ],
    },
  });
};
