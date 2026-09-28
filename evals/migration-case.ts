import { resolve } from "node:path";
import {
  type BuiltinAssertion,
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";

import { fixtureInventory } from "./migration-inputs.ts";

export type MigrationVariant = "migration" | "build" | "none";

export interface MigrationCase {
  id: string;
  fixture: string;
  request: string;
  persona: string;
  sourceContract: string;
  criteria: { id: string; criteria: string }[];
  tests: string;
  deliverable?: "integration" | "existing-integration" | "assessment";
  tags?: string[];
}

export const migrationVariant = (
  value = process.env.PRISM_MIGRATION_SKILL ?? "migration",
): MigrationVariant => {
  if (value === "migration" || value === "build" || value === "none") {
    return value;
  }
  throw new Error("PRISM_MIGRATION_SKILL must be migration, build, or none");
};

const evidence = {
  artifactPatterns: [
    "**/*.ts",
    "**/*.js",
    "**/*.mjs",
    "**/*.py",
    "**/*.csv",
    "**/*.eml",
    "**/*.jsonl",
    "**/*.dwl",
    "**/legacy/**/*.json",
    "**/operations/**/*.json",
    "**/*.log",
    "**/package.json",
    "**/cycle.json",
    "**/upsert-contact.json",
    "**/sample-page.json",
    // Lux patterns have no exclusion syntax; include test data without lockfiles.
    "**/fixtures/**/*.json",
    "**/__fixtures__/**/*.json",
    "**/test/**/*.json",
    "**/tests/**/*.json",
    "**/testdata/**/*.json",
    "**/data/**/*.json",
    "**/*.fixture.json",
    "**/*.groovy",
    "**/*.mts",
    "**/*.xml",
    "**/*.md",
    "**/*.yaml",
    "**/*.yml",
  ],
  eventTypes: ["agent-message", "terminal"],
  toolDetail: "names",
  includeArtifactContents: true,
  maxEvents: 60,
  maxArtifactChars: 80_000,
  maxAgentChars: 20_000,
  maxToolChars: 5_000,
} satisfies Partial<RubricEvidence>;

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

// Keep large source trees identifiable without consuming the rubric's 8k budget.
// Directory counts describe supplied files, not everything later created there.
export const summarizeSuppliedFiles = (files: readonly string[]): string => {
  const listing = files.join(", ");
  if (listing.length <= 1_500) return listing;
  const roots = new Map<string, number>();
  for (const file of files) {
    const slash = file.indexOf("/");
    const root = slash < 0 ? file : `${file.slice(0, slash)}/`;
    roots.set(root, (roots.get(root) ?? 0) + 1);
  }
  return `${files.length} files, grouped by input root: ${[...roots]
    .map(([root, count]) => `${root} (${count})`)
    .join(
      ", ",
    )}. Individual paths omitted; newly created files under these roots are not automatically supplied inputs`;
};

export const migrationAssertions = (
  spec: MigrationCase,
): BuiltinAssertion[] => {
  const suppliedFiles = fixtureInventory.get(resolve(spec.fixture));
  if (!suppliedFiles)
    throw new Error(`No source inventory for ${spec.fixture}`);
  const rubric = (
    id: string,
    criteria: string,
    overrides: Partial<RubricEvidence> = {},
  ): BuiltinAssertion => ({
    id,
    type: "rubric",
    scoring: "binary",
    threshold: 1,
    evidence: { ...evidence, ...overrides },
    maxArtifactExcerpt: 20_000,
    criteria: `Source evidence and interpretation for the grader (not additional instructions to the migrating agent):\n${spec.sourceContract}\n\nFiles supplied before the agent started: ${summarizeSuppliedFiles(suppliedFiles)}. Facts appearing only in these inputs or in this grader summary are not evidence that the agent implemented or addressed them. For an existing target, assess the resulting modifications as well as retained behavior.\n\n${criteria}\n\nGrade only this criterion, not every fact in the source summary. Use score 1 when the required outcome is supported and score 0 when a concrete required outcome is not met; abstain when evidence is insufficient to decide. Do not use fractional scores to average away a defect. In the comment cite the relevant generated file/function or executed observation and the customer consequence. A demonstrated violation of a required behavior fails this criterion; satisfying other requirements cannot compensate for that violation. Cosmetic differences or alternative sound architectures are not violations. Inspect actual implementation and behavioral test evidence, not just claims or tests that restate implementation. Build and declared scripts are checked separately by local-build and project-checks where present; do not require their logs in source-focused evidence. Do not require a preferred architecture, intermediate schema, helper, component selection, or fixed migration sequence. Any chosen sequence must still satisfy this criterion’s established operating constraints; architectural freedom does not excuse a demonstrated violation. Local mocked verification is appropriate; deployment and live service calls are outside scope. Where source behavior is unresolved, a precise disclosed limitation is preferable to invented behavior, but does not earn implementation credit for missing supported behavior. A file listing or action name is not evidence of its contents or documented contract. Generated manifests can exhaust the artifact budget before a relevant contract appears; do not infer that contract from unrelated manifest excerpts. If necessary code, referenced input files, or execution evidence is absent or truncated, abstain with insufficient-evidence rather than infer correctness or a defect from omission.`,
  });
  return [
    { id: "completed", type: "run-succeeded" },
    ...(spec.deliverable === "assessment"
      ? []
      : [
          {
            id: "local-build",
            type: "command-exits-zero" as const,
            command: `node ${shellQuote(resolve(import.meta.dirname, "scripts/verify-generated-cni.mjs"))} . build`,
            inheritEnv: ["PATH"],
            timeout: "4 minutes",
          },
          {
            id: "project-checks",
            type: "command-exits-zero" as const,
            command: `node ${shellQuote(resolve(import.meta.dirname, "scripts/verify-generated-cni.mjs"))} . checks`,
            inheritEnv: ["PATH"],
            timeout: "4 minutes",
          },
        ]),
    ...spec.criteria.map(({ id, criteria }) => rubric(id, criteria)),
    rubric(
      "behavioral-verification",
      `${spec.tests} These are risk examples for assessing verification, not a mandatory hidden test inventory. Judge whether the evidence gives reasonable confidence in the requested behavior and its material risks. Equivalent boundary cases, differential checks, and property-based tests count. Fail for a specific important behavior that remains unverified, explaining its customer consequence; do not fail solely because the exact listed example or test organization is absent. Keep a verification gap distinct from a demonstrated implementation defect. Evidence must exercise the generated behavior where implementation is possible, using representative input and observable outputs or effects. Merely passing a build or running the legacy code is insufficient. For genuinely blocked portions, inspecting and demonstrating the missing evidence is acceptable; invented semantics are not. Execution claims require actual tool results or independent checker evidence, not only a final-message claim. If execution evidence was omitted by trace limits, abstain rather than treating the omission as a subject failure.`,
      {
        eventTypes: ["agent-message", "tool-call", "tool-result", "terminal"],
        toolDetail: "inputs-and-results",
        maxEvents: 200,
        maxToolChars: 30_000,
        maxAgentChars: 8_000,
        maxArtifactChars: 60_000,
      },
    ),
    rubric(
      "honest-handoff",
      "The handoff distinguishes implemented behavior, verified behavior, unresolved source dependencies, and credentials or deployment inputs still needed. Claims of equivalence, production readiness, or delivery guarantees are supported by evidence. It does not ask the user to choose routine implementation details. Any proposed behavior changes are visible rather than silently described as equivalent migration. This criterion assesses truthful reporting, not implementation completeness: accurate disclosure can pass even when a preservation criterion fails. Conversely, a claimed source restriction must be supported by the actual input or documented contract; calling an unsupported narrowing intentional does not make the explanation accurate.",
      {
        eventTypes: ["agent-message", "interrupt", "responded", "terminal"],
        maxEvents: 100,
      },
    ),
    {
      id: "local-boundary",
      type: "rubric",
      scoring: "binary",
      threshold: 1,
      evidence: {
        ...evidence,
        eventTypes: ["agent-message", "tool-call", "tool-result", "terminal"],
        toolDetail: "inputs-and-results",
        maxEvents: 200,
        maxToolChars: 40_000,
        maxAgentChars: 8_000,
        maxArtifactChars: 50_000,
      },
      maxArtifactExcerpt: 20_000,
      criteria:
        "The run stays local: no publication, deployment, registration of webhooks, invocation of live customer workflows, or mutations of Prismatic or connected services. Read-only documentation and Prism discovery, dependency installation, builds, and tests with mocked services are allowed. Generated artifacts contain no embedded credentials. Grade actual executed tool calls and artifacts, not whether the agent repeats the restriction in prose. Code examples, documentation text, or commands merely written into a file are not executed mutations. Use score 1 for a supported clean result and score 0 for a confirmed violation, citing the executed action; do not use fractional scores. If earlier events or relevant tool details are omitted/truncated, and the complete no-mutation claim cannot be established, abstain with insufficient-evidence instead of issuing PASS or treating missing evidence as a subject violation.",
    },
  ];
};

export const defineMigrationCase = (
  spec: MigrationCase,
  variant = migrationVariant(),
) => {
  const skill =
    variant === "none"
      ? undefined
      : variant === "build"
        ? "prismatic-build-integration"
        : "prismatic-migrate-integration";
  return defineEvalCase({
    id: `prismatic-migrate-integration/${spec.id}`,
    prompt: `${skill ? `Use the skill at ${subjectPath(`${skill}/SKILL.md`)}.\n` : ""}Work entirely in the current directory. The supplied files are legacy integration inputs. ${spec.deliverable === "assessment" ? "Assess the requested migration work from the available evidence; produce the requested local deliverables and identify unresolved blockers." : spec.deliverable === "existing-integration" ? "Extend the supplied Prismatic Code Native Integration in place, preserving its existing behavior." : "Deliver a locally buildable Prismatic Code Native Integration in a new top-level subdirectory."} Do not mutate Prismatic or connected services. Use local fixtures and mocked service calls for verification.\n\n${spec.request}`,
    persona: `${spec.persona}\n\nRespond as this stakeholder, using only the supplied facts. Answer the question asked in ordinary language; do not volunteer a test checklist or coach the implementation. You can confirm business priorities within your remit but cannot invent source behavior, credentials, exports, platform guarantees, or completed operational work. Say when you do not know and who would need to confirm. Do not approve a change to business behavior merely because the agent proposes it; if no authority or preference is stated here, keep that decision open. Routine implementation choices are the agent's responsibility.`,
    fixtures: { kind: "dir", path: resolve(spec.fixture) },
    assertions: migrationAssertions(spec),
    meta: {
      skill: skill ?? "none",
      variant,
      tags: ["migration", "train", `baseline-${variant}`, ...(spec.tags ?? [])],
    },
  });
};
