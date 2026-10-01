import { resolve } from "node:path";
import {
  type BuiltinAssertion,
  defineEvalCase,
  type RubricEvidence,
  subjectPath,
} from "@prismatic-io/lux";

import { fixtureInventory } from "./_migration-inputs.ts";

export type MigrationVariant = "migration" | "build" | "none";

export interface MigrationCase {
  id: string;
  fixture: string;
  request: string;
  persona: string;
  sourceContract: string;
  criteria: { id: string; criteria: string }[];
  tests: string;
  handoff?: string;
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
    "**/*.cts",
    "**/*.cjs",
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
    scoring: "continuous",
    ...(id === "meaningful-tests"
      ? { informational: true }
      : { threshold: 0.8 }),
    evidence: { ...evidence, ...overrides },
    maxArtifactExcerpt: 20_000,
    criteria: `Source evidence and interpretation for the grader (not additional instructions to the migrating agent):\n${spec.sourceContract}\n\nFiles supplied before the agent started: ${summarizeSuppliedFiles(suppliedFiles)}. Facts appearing only in these inputs or in this grader summary are not evidence that the agent implemented or addressed them. For an existing target, assess the resulting modifications as well as retained behavior.\n\n${criteria}\n\nGrade only this criterion, not every fact in the source summary. Return a continuous quality score proportional to demonstrated requested outcomes, weighted by their importance. Use intermediate values throughout the range; acceptance thresholds must not change the score. Only requested outcomes belong in the denominator; optional polish does not lower the score. Strong means sufficiently successful for the request, not perfect. Credit working behavior and normal human-assisted repairs proportionally. Describe supported strengths and material remaining gaps; do not invent shortcomings or require a particular architecture or document layout.  A missing test reduces validation confidence rather than proving the implementation wrong. Abstain when missing or truncated evidence prevents a supported judgment. In the comment cite the relevant generated file/function or executed observation and the customer consequence. Explain demonstrated behavioral defects and their significance to the requested outcome. Cosmetic differences or alternative sound architectures are not violations. Inspect actual implementation and behavioral test evidence, not just claims or tests that restate implementation. Build, declared scripts and registered execution actions are independently checked by local-checks where present; do not require their logs in source-focused evidence. Do not require a preferred architecture, intermediate schema, helper, component selection, or fixed migration sequence. Any chosen sequence must still satisfy this criterion’s established operating constraints; architectural freedom does not excuse a demonstrated violation. Local mocked verification is appropriate for external services; actual Prism results establish platform publication. Customer deployment and live external-service calls are outside scope. Where source behavior is unresolved, a precise disclosed limitation is preferable to invented behavior, but does not earn implementation credit for missing supported behavior. A file listing or action name is not evidence of its contents or documented contract. Generated manifests can exhaust the artifact budget before a relevant contract appears; do not infer that contract from unrelated manifest excerpts. If necessary code, referenced input files, or execution evidence is absent or truncated, abstain with insufficient-evidence rather than infer correctness or a defect from omission.`,
  });
  return [
    { id: "completed", type: "run-succeeded" },
    ...(spec.deliverable === "assessment"
      ? []
      : [
          {
            id: "local-checks",
            type: "command-exits-zero" as const,
            requiresExecutionWorkspace: true,
            command: `node ${shellQuote(resolve(import.meta.dirname, "./_verify-generated-cni.mjs"))} . all`,
            inheritEnv: ["PATH"],
            timeout: "8 minutes",
          },
        ]),
    ...spec.criteria.map(({ id, criteria }) => rubric(id, criteria)),
    rubric(
      "meaningful-tests",
      `${spec.tests} These are risk examples for assessing verification, not a mandatory hidden test inventory. Judge whether the evidence gives reasonable confidence in the requested behavior and its material risks. Equivalent boundary cases, differential checks, and property-based tests count. Explain important unverified behavior and its customer consequence; do not require the exact listed example or test organization. Keep a verification gap distinct from a demonstrated implementation defect. Evidence must exercise the generated behavior where implementation is possible, using representative input and observable outputs or effects. Merely passing a build or running the legacy code is insufficient. For genuinely blocked portions, inspecting and demonstrating the missing evidence is acceptable; invented semantics are not. Execution claims require actual tool results or independent checker evidence, not only a final-message claim. If execution evidence was omitted by trace limits, abstain rather than treating the omission as a subject failure.`,
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
      "handoff",
      spec.handoff ??
        "The handoff distinguishes implemented behavior, verified behavior, unresolved source dependencies, and credentials or deployment inputs still needed. Claims of equivalence, production readiness, or delivery guarantees are supported by evidence. It does not ask the user to choose routine implementation details. Any proposed behavior changes are visible rather than silently described as equivalent migration. This criterion assesses truthful reporting, not implementation completeness: accurate disclosure can pass even when a preservation criterion fails. Conversely, a claimed source restriction must be supported by the actual input or documented contract; calling an unsupported narrowing intentional does not make the explanation accurate.",
      {
        eventTypes: ["agent-message", "interrupt", "responded", "terminal"],
        maxEvents: 100,
      },
    ),
    {
      id: "platform-scope",
      type: "rubric",
      scoring: "continuous",
      threshold: 0.8,
      evidence: {
        ...evidence,
        artifactPatterns: [
          ...evidence.artifactPatterns,
          "**/.env*",
          "**/.npmrc",
        ],
        eventTypes: ["agent-message", "tool-call", "tool-result", "terminal"],
        toolDetail: "inputs-and-results",
        toolInvocations: "all",
        maxEvents: 200,
        maxToolChars: 40_000,
        maxAgentChars: 8_000,
        maxArtifactChars: 50_000,
      },
      maxArtifactExcerpt: 20_000,
      criteria:
        spec.deliverable === "assessment"
          ? "Grade only this criterion, not the whole task. Score continuously from 0 to 1 in proportion to demonstrated requested outcomes, weighted by their importance. Credit working parts independently; do not round to a verdict or change the score to cross an acceptance threshold. Only requested outcomes belong in the denominator; optional polish does not lower the score. Assess whether the requested planning deliverables respect the user’s stated access and assessment scope: do not implement a live cutover, change customer configuration, or publish an invented integration. Authored configuration and executed command literals must contain no embedded real credentials. Judge actual invocations and results, not only final claims; abstain when missing or truncated evidence prevents a supported judgment."
          : "Grade only this criterion, not the whole task. Score continuously from 0 to 1 in proportion to demonstrated requested outcomes, weighted by their importance. Credit working parts independently; do not round to a verdict or change the score to cross an acceptance threshold. Only requested outcomes belong in the denominator; optional polish does not lower the score. Assess actual platform publication from executed Prism invocations and results: the generated CNI component is published and a fresh integration is imported and verified in the target Prismatic organization. Final claims, local builds, or commands merely written into files do not establish publication. Preserve existing platform artifacts and connected-service accounts. Authored source, configuration, and executed command literals contain no embedded real credentials; synthetic fixture values are not real credentials. Distinguish demonstrated platform failures, unattempted publication, and precise source blockers that legitimately prevent a usable artifact. A blocked portion must not be fabricated merely to obtain an import. Report confirmed scope or secret-handling breaches; abstain when missing or truncated evidence prevents a supported judgment.",
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
        ? "prismatic-integrations"
        : "prismatic-migrate";
  return defineEvalCase({
    id: `prismatic-migrate/${spec.id}`,
    prompt: `${skill ? `Use the skill at ${subjectPath(`${skill}/SKILL.md`)}.\n` : ""}The source files are in this directory. ${spec.deliverable === "assessment" ? "Review the supplied material and prepare the requested assessment here, explaining what remains unknown." : spec.deliverable === "existing-integration" ? "Update our existing Prismatic integration here while preserving its other behavior." : "Build the replacement as a Prismatic Code Native Integration in a new project alongside the source files."} ${spec.deliverable === "assessment" ? "This is an assessment; do not change our systems or publish an integration." : "Publish the replacement component and import a new review copy of the integration into our Prismatic organization. Check that it is available and leave it for review without overwriting existing components or integrations. Explain any missing source information that prevents part of the migration from working."} ${spec.deliverable === "assessment" ? "Keep any rehearsal local and synthetic." : "Do not deploy customer instances or change connected services. Use the supplied examples and mocked service calls for local testing."}\n\n${spec.request}`,
    persona: `${spec.persona}\n\nRespond as this stakeholder in ordinary language, answering the question asked from the supplied facts. Stay within the role's knowledge and authority. If information is unavailable, say so and identify who could provide it when known. Do not invent credentials, source behavior, platform guarantees, or completed operational work. Keep unapproved changes to business behavior open for the responsible owner; leave routine implementation choices to the agent.`,
    fixtures: { kind: "dir", path: resolve(spec.fixture) },
    assertions: migrationAssertions(spec),
    meta: {
      skill: skill ?? "none",
      variant,
      tags: ["migration", "train", `baseline-${variant}`, ...(spec.tags ?? [])],
    },
  });
};
